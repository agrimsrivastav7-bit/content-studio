import sqlite3
import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "dlf_content.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS content_requests (
        id TEXT PRIMARY KEY,
        topic TEXT,
        target_keyword TEXT,
        content_type TEXT,
        project_reference TEXT,
        target_audience TEXT,
        status TEXT,
        current_agent TEXT,
        draft_content TEXT,
        original_draft TEXT,
        edited_draft TEXT,
        brief TEXT,
        retrieved_facts TEXT,
        headline_variants TEXT,
        factual_confidence_score INTEGER,
        compliance_flags TEXT,
        brand_feedback TEXT,
        seo_feedback TEXT,
        risk_summary TEXT,
        risk_scores TEXT,
        risk_level TEXT,
        logs TEXT,
        created_at DATETIME,
        updated_at DATETIME,
        version INTEGER DEFAULT 1
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS content_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT,
        version INTEGER,
        draft_content TEXT,
        author TEXT,
        created_at DATETIME,
        notes TEXT,
        FOREIGN KEY(request_id) REFERENCES content_requests(id)
    )
    ''')
    
    conn.commit()
    conn.close()

# Initialize on import
init_db()

def _to_json(data: Any) -> Optional[str]:
    if data is None:
        return None
    return json.dumps(data)

def _from_json(data: Optional[str]) -> Any:
    if data is None:
        return None
    try:
        return json.loads(data)
    except:
        return None

def create_request(request_id: str, payload: Dict[str, Any]):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    cursor.execute('''
    INSERT INTO content_requests (
        id, topic, target_keyword, content_type, project_reference, target_audience,
        status, current_agent, logs, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        request_id,
        payload.get("topic"),
        payload.get("target_keyword"),
        payload.get("content_type"),
        payload.get("project_reference"),
        payload.get("target_audience"),
        "processing",
        "Initializing",
        _to_json(["Starting agent workflow..."]),
        now,
        now
    ))
    conn.commit()
    conn.close()

def update_request(request_id: str, state_data: Dict[str, Any]):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    # Handle original_draft if provided
    update_fields = [
        "status = ?", "current_agent = ?", "draft_content = ?", "brief = ?",
        "retrieved_facts = ?", "headline_variants = ?", "factual_confidence_score = ?", 
        "compliance_flags = ?", "brand_feedback = ?",
        "seo_feedback = ?", "risk_summary = ?", "risk_scores = ?", "risk_level = ?",
        "logs = ?", "updated_at = ?"
    ]
    
    values = [
        state_data.get("status"),
        state_data.get("current_agent"),
        state_data.get("draft_content"),
        state_data.get("brief"),
        _to_json(state_data.get("retrieved_facts")),
        _to_json(state_data.get("headline_variants")),
        state_data.get("factual_confidence_score"),
        _to_json(state_data.get("compliance_flags")),
        state_data.get("brand_feedback"),
        state_data.get("seo_feedback"),
        state_data.get("risk_summary"),
        _to_json(state_data.get("risk_scores")),
        state_data.get("risk_level"),
        _to_json(state_data.get("logs")),
        now
    ]
    
    if "original_draft" in state_data:
        update_fields.append("original_draft = ?")
        values.append(state_data["original_draft"])
        
    if "edited_draft" in state_data:
        update_fields.append("edited_draft = ?")
        values.append(state_data["edited_draft"])
        
    query = f'''
    UPDATE content_requests SET {", ".join(update_fields)} WHERE id = ?
    '''
    values.append(request_id)
    
    cursor.execute(query, values)
    conn.commit()
    conn.close()

def get_request(request_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM content_requests WHERE id = ?", (request_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    result = dict(row)
    # Parse JSON fields
    result["retrieved_facts"] = _from_json(result["retrieved_facts"]) or []
    result["headline_variants"] = _from_json(result["headline_variants"]) or []
    result["compliance_flags"] = _from_json(result["compliance_flags"]) or []
    result["risk_scores"] = _from_json(result["risk_scores"])
    result["logs"] = _from_json(result["logs"]) or []
    
    return result

def get_recent_requests(limit: int = 10) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, topic, target_keyword, status, risk_level, created_at FROM content_requests ORDER BY created_at DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_stats() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM content_requests")
    total = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(*) as pending FROM content_requests WHERE status = 'awaiting_review'")
    pending = cursor.fetchone()["pending"]
    
    cursor.execute("SELECT COUNT(*) as high_risk FROM content_requests WHERE risk_level = 'High'")
    high_risk = cursor.fetchone()["high_risk"]
    
    cursor.execute("SELECT COUNT(*) as approved FROM content_requests WHERE status = 'completed'")
    approved = cursor.fetchone()["approved"]
    
    conn.close()
    
    return {
        "total": total,
        "pending": pending,
        "high_risk": high_risk,
        "approved": approved
    }

def add_version(request_id: str, version: int, draft_content: str, author: str, notes: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    cursor.execute('''
    INSERT INTO content_versions (request_id, version, draft_content, author, created_at, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', (request_id, version, draft_content, author, now, notes))
    
    # Update version in main table
    cursor.execute("UPDATE content_requests SET version = ? WHERE id = ?", (version, request_id))
    
    conn.commit()
    conn.close()

def get_versions(request_id: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM content_versions WHERE request_id = ? ORDER BY version ASC", (request_id,))
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def reject_request(request_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    cursor.execute("SELECT logs FROM content_requests WHERE id = ?", (request_id,))
    row = cursor.fetchone()
    logs = _from_json(row["logs"]) if row and row["logs"] else []
    logs.append("Draft rejected by user.")
    
    cursor.execute('''
    UPDATE content_requests 
    SET status = ?, current_agent = ?, logs = ?, updated_at = ?
    WHERE id = ?
    ''', ("rejected", "Rejected by User", _to_json(logs), now, request_id))
    
    conn.commit()
    conn.close()

def retry_request(request_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    cursor.execute('''
    UPDATE content_requests 
    SET status = ?, 
        current_agent = ?, 
        draft_content = NULL,
        original_draft = NULL,
        edited_draft = NULL,
        brief = NULL,
        retrieved_facts = NULL,
        compliance_flags = NULL,
        brand_feedback = NULL,
        seo_feedback = NULL,
        risk_summary = NULL,
        risk_scores = NULL,
        risk_level = NULL,
        logs = ?, 
        updated_at = ?
    WHERE id = ?
    ''', ("processing", "Initializing", _to_json(["Retry requested by user. Restarting workflow..."]), now, request_id))
    
    cursor.execute("DELETE FROM content_versions WHERE request_id = ?", (request_id,))
    
    conn.commit()
    conn.close()

def delete_request(request_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM content_versions WHERE request_id = ?", (request_id,))
    cursor.execute("DELETE FROM content_requests WHERE id = ?", (request_id,))
    
    conn.commit()
    conn.close()
