from fastapi import APIRouter
from typing import Dict, Any, List
from .. import database as db
import json

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/")
async def get_analytics_dashboard() -> Dict[str, Any]:
    conn = db.get_connection()
    cursor = conn.cursor()
    
    # 1. Overall Stats
    cursor.execute("SELECT COUNT(*) as total FROM content_requests")
    total = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(*) as pending FROM content_requests WHERE status = 'awaiting_review'")
    pending = cursor.fetchone()["pending"]
    
    cursor.execute("SELECT COUNT(*) as approved FROM content_requests WHERE status = 'completed'")
    approved = cursor.fetchone()["approved"]
    
    cursor.execute("SELECT COUNT(*) as high_risk FROM content_requests WHERE risk_level = 'High'")
    high_risk = cursor.fetchone()["high_risk"]
    
    # 2. Risk Distribution
    cursor.execute("SELECT risk_level, COUNT(*) as count FROM content_requests WHERE risk_level IS NOT NULL GROUP BY risk_level")
    risk_dist = [{"level": r["risk_level"], "count": r["count"]} for r in cursor.fetchall()]
    
    # 3. Project Scores (Average)
    cursor.execute('''
        SELECT project_reference, 
               AVG(factual_confidence_score) as avg_factual,
               AVG(CAST(json_extract(risk_scores, '$.compliance') AS INTEGER)) as avg_compliance,
               AVG(CAST(json_extract(risk_scores, '$.brand_alignment') AS INTEGER)) as avg_brand,
               AVG(CAST(json_extract(risk_scores, '$.seo') AS INTEGER)) as avg_seo,
               COUNT(*) as doc_count
        FROM content_requests 
        WHERE project_reference IS NOT NULL AND project_reference != 'none'
        GROUP BY project_reference
    ''')
    
    project_scores = []
    for row in cursor.fetchall():
        project_scores.append({
            "project": row["project_reference"].title(),
            "factual": round(row["avg_factual"] or 0, 1),
            "compliance": round(row["avg_compliance"] or 0, 1),
            "brand": round(row["avg_brand"] or 0, 1),
            "seo": round(row["avg_seo"] or 0, 1),
            "documents": row["doc_count"]
        })
        
    # 4. Top Violations (Parse compliance flags)
    cursor.execute("SELECT compliance_flags FROM content_requests WHERE compliance_flags IS NOT NULL")
    all_flags = []
    for row in cursor.fetchall():
        flags_json = row["compliance_flags"]
        if flags_json:
            try:
                flags = json.loads(flags_json)
                all_flags.extend(flags)
            except:
                pass
                
    violation_counts = {}
    for flag in all_flags:
        if "No significant" in flag:
            continue
        # Extract category if possible
        category = "General"
        if flag.startswith("- ["):
            category = flag.split("]")[0].replace("- [", "")
        violation_counts[category] = violation_counts.get(category, 0) + 1
        
    top_violations = [{"category": k, "count": v} for k, v in sorted(violation_counts.items(), key=lambda item: item[1], reverse=True)[:5]]
    
    conn.close()
    
    return {
        "summary": {
            "total": total,
            "pending": pending,
            "approved": approved,
            "high_risk": high_risk
        },
        "risk_distribution": risk_dist,
        "project_scores": project_scores,
        "top_violations": top_violations
    }
