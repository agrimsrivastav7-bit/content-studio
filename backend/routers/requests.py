import uuid
import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from ..models.schemas import ContentRequestInput, ContentRequestResponse
from ..agents.workflow import app_workflow, compliance_validator, brand_tone_validator, seo_intelligence_agent, risk_scoring_engine
from .. import database as db

router = APIRouter(prefix="/requests", tags=["Requests"])

# ─── HELPERS ───────────────────────────────────────────

def _get_state_values(config):
    """Safely extract state values and next nodes from LangGraph state snapshot."""
    graph_state = app_workflow.get_state(config)
    state_values = getattr(graph_state, 'values', None)
    if state_values is None and isinstance(graph_state, tuple):
        state_values = graph_state[2] if len(graph_state) > 2 else {}
    next_nodes = getattr(graph_state, 'next', None)
    if next_nodes is None and isinstance(graph_state, tuple):
        next_nodes = graph_state[3] if len(graph_state) > 3 else []
    return state_values or {}, next_nodes or []


def _build_status_dict(state: dict, status: str, current_agent: str):
    """Build a consistent status response dict from workflow state."""
    
    # Compute overall risk level from scores
    scores = [
        state.get("factual_confidence_score"),
        state.get("compliance_score"),
        state.get("brand_alignment_score"),
        state.get("seo_score"),
    ]
    valid_scores = [s for s in scores if s is not None]
    avg_score = sum(valid_scores) / len(valid_scores) if valid_scores else None
    
    if avg_score is not None:
        if avg_score >= 85:
            risk_level = "Low"
        elif avg_score >= 70:
            risk_level = "Medium"
        else:
            risk_level = "High"
    else:
        risk_level = None
    
    return {
        "status": status,
        "current_agent": current_agent,
        "draft_content": state.get("draft"),
        "brief": state.get("brief"),
        "retrieved_facts": state.get("retrieved_facts", []),
        "headline_variants": state.get("headline_variants", []),
        "risk_scores": {
            "factual_confidence": state.get("factual_confidence_score"),
            "compliance": state.get("compliance_score"),
            "brand_alignment": state.get("brand_alignment_score"),
            "seo": state.get("seo_score"),
        },
        "risk_level": risk_level,
        "compliance_flags": state.get("compliance_flags", []),
        "brand_feedback": state.get("brand_feedback"),
        "seo_feedback": state.get("seo_feedback"),
        "risk_summary": state.get("risk_summary"),
        "logs": state.get("workflow_logs", []),
    }


# ─── WORKFLOW RUNNERS ──────────────────────────────────

AGENT_MAP = {
    "content_strategist": "Content Strategist Agent",
    "retrieval_engine": "Retrieval Engine",
    "competitor_intelligence": "Competitor Intelligence Agent",
    "drafting_agent": "Drafting Agent",
    "localization_agent": "Localization Agent",
    "compliance_validator": "Compliance Validator",
    "brand_tone_validator": "Brand Tone Validator",
    "seo_intelligence_agent": "SEO Intelligence Agent",
    "risk_scoring_engine": "Risk Scoring Engine",
}


async def run_langgraph_workflow(request_id: str, payload: dict):
    initial_state = {
        "request_id": request_id,
        "topic": payload.get("topic"),
        "target_keyword": payload.get("target_keyword"),
        "content_type": payload.get("content_type"),
        "project_reference": payload.get("project_reference"),
        "target_audience": payload.get("target_audience"),
        "brief": None,
        "retrieved_facts": [],
        "draft": None,
        "factual_confidence_score": None,
        "compliance_score": None,
        "brand_alignment_score": None,
        "seo_score": None,
        "compliance_flags": [],
        "brand_feedback": None,
        "seo_feedback": None,
        "risk_summary": None,
        "workflow_logs": [],
    }
    config = {"configurable": {"thread_id": request_id}}

    def run_graph():
        last_state = initial_state
        try:
            for output in app_workflow.stream(initial_state, config):
                for node_name, state in output.items():
                    if not isinstance(state, dict):
                        continue
                    last_state = state
                    current_agent = AGENT_MAP.get(node_name, node_name)
                    
                    status_dict = _build_status_dict(state, "processing", current_agent)
                    db.update_request(request_id, status_dict)

            # Check if graph paused at a breakpoint
            state_values, next_nodes = _get_state_values(config)
            if next_nodes:
                status_dict = _build_status_dict(state_values, "awaiting_review", "Human Review Required")
                db.update_request(request_id, status_dict)
                
                # Version 1: AI Draft
                if state_values.get("draft"):
                    db.add_version(request_id, 1, state_values["draft"], "AI Agent", "Initial AI Generation")
                
                return state_values

        except Exception as e:
            req = db.get_request(request_id)
            if req:
                logs = req.get("logs", [])
                logs.append(f"Error: {str(e)}")
                db.update_request(request_id, {"status": "failed", "logs": logs, "current_agent": "Error"})
            return None

        return state_values if 'state_values' in locals() else last_state

    final_state = await asyncio.to_thread(run_graph)

    req = db.get_request(request_id)
    if final_state and req and req.get("status") != "awaiting_review":
        status_dict = _build_status_dict(final_state, "completed", "Risk Scoring Engine")
        db.update_request(request_id, status_dict)


async def resume_langgraph_workflow(request_id: str, edited_draft: str):
    config = {"configurable": {"thread_id": request_id}}

    def run_resume():
        try:
            # Store original draft before updating state if not already stored
            # (Handled in the router endpoint before calling this)
            
            app_workflow.update_state(config, {"draft": edited_draft})

            for output in app_workflow.stream(None, config):
                for node_name, state in output.items():
                    if not isinstance(state, dict):
                        continue
                    current_agent = AGENT_MAP.get(node_name, node_name)
                    status_dict = _build_status_dict(state, "processing", current_agent)
                    db.update_request(request_id, status_dict)

            state_values, _ = _get_state_values(config)
            status_dict = _build_status_dict(state_values, "completed", "Risk Scoring Engine")
            db.update_request(request_id, status_dict)
            
            # Version 3: Validated
            if state_values.get("draft"):
                db.add_version(request_id, 3, state_values["draft"], "System — Validated", "Final compliance check complete")
            
        except Exception as e:
            req = db.get_request(request_id)
            if req:
                logs = req.get("logs", [])
                logs.append(f"Error resuming: {str(e)}")
                db.update_request(request_id, {"status": "failed", "logs": logs, "current_agent": "Error"})

    await asyncio.to_thread(run_resume)


# ─── ROUTES ────────────────────────────────────────────

@router.get("/")
async def list_requests(limit: int = 10):
    return db.get_recent_requests(limit)

@router.get("/stats")
async def get_stats():
    return db.get_stats()

@router.get("/{request_id}/versions")
async def get_request_versions(request_id: str):
    return db.get_versions(request_id)

@router.post("/", response_model=ContentRequestResponse)
async def create_content_request(request: ContentRequestInput, background_tasks: BackgroundTasks):
    request_id = f"REQ-{str(uuid.uuid4())[:8].upper()}"

    db.create_request(request_id, request.dict())

    background_tasks.add_task(run_langgraph_workflow, request_id, request.dict())

    return ContentRequestResponse(
        request_id=request_id,
        status="accepted",
        message="Request accepted. The agent workflow has started.",
    )


@router.get("/{request_id}/status")
async def get_request_status(request_id: str):
    req = db.get_request(request_id)
    if req:
        return req
    return {"status": "not_found", "message": "Request ID not found or not tracked."}


class ResumeRequestInput(BaseModel):
    edited_draft: str


@router.post("/{request_id}/resume")
async def resume_workflow(request_id: str, payload: ResumeRequestInput, background_tasks: BackgroundTasks):
    req = db.get_request(request_id)
    if not req:
        return {"status": "not_found", "message": "Request not found."}

    if req.get("status") != "awaiting_review":
        return {"status": "error", "message": "Request is not awaiting review."}

    logs = req.get("logs", [])
    logs.append("Human review approved. Resuming validation pipeline...")
    
    # Store original draft, set edited draft
    original_draft = req.get("draft_content")
    
    db.update_request(request_id, {
        "status": "processing",
        "current_agent": "Compliance Validator",
        "logs": logs,
        "original_draft": original_draft,
        "edited_draft": payload.edited_draft
    })
    
    # Version 2: Human Edit
    db.add_version(request_id, 2, payload.edited_draft, "Human Reviewer", "Manual edits applied before validation")

    background_tasks.add_task(resume_langgraph_workflow, request_id, payload.edited_draft)

    return {"status": "resumed", "message": "Workflow resumed. Validation agents are now processing."}


@router.post("/{request_id}/reject")
async def reject_request_workflow(request_id: str):
    req = db.get_request(request_id)
    if not req:
        return {"status": "not_found", "message": "Request not found."}

    if req.get("status") != "awaiting_review":
        return {"status": "error", "message": "Request is not awaiting review."}

    db.reject_request(request_id)
    return {"status": "rejected", "message": "Workflow rejected and archived."}

@router.post("/{request_id}/retry")
async def retry_request_workflow(request_id: str, background_tasks: BackgroundTasks):
    req = db.get_request(request_id)
    if not req:
        return {"status": "not_found", "message": "Request not found."}

    if req.get("status") != "failed":
        return {"status": "error", "message": "Only failed requests can be retried."}

    db.retry_request(request_id)
    
    payload = {
        "topic": req.get("topic"),
        "target_keyword": req.get("target_keyword"),
        "content_type": req.get("content_type"),
        "project_reference": req.get("project_reference"),
        "target_audience": req.get("target_audience")
    }
    background_tasks.add_task(run_langgraph_workflow, request_id, payload)
    
    return {"status": "processing", "message": "Workflow retry initiated."}

# ─── ITERATIVE WORKFLOW PIPELINES ───────────────────────

async def run_validation_only_pipeline(request_id: str, edited_draft: str, new_version: int):
    def run_pipeline():
        try:
            req = db.get_request(request_id)
            if not req:
                return
            
            # Reconstruct workflow state for validation rerun
            state = {
                "request_id": request_id,
                "topic": req.get("topic"),
                "target_keyword": req.get("target_keyword"),
                "content_type": req.get("content_type"),
                "project_reference": req.get("project_reference"),
                "target_audience": req.get("target_audience"),
                "brief": req.get("brief"),
                "retrieved_facts": req.get("retrieved_facts", []),
                "draft": edited_draft,
                "factual_confidence_score": None,
                "compliance_score": None,
                "brand_alignment_score": None,
                "seo_score": None,
                "compliance_flags": [],
                "brand_feedback": None,
                "seo_feedback": None,
                "risk_summary": None,
                "workflow_logs": req.get("logs", []),
            }
            
            # Step 1: Compliance Validator (RERA audit)
            state["workflow_logs"].append("Rerun Validation: Running Compliance Validator (Strict RERA Audit)...")
            db.update_request(request_id, {"current_agent": "Compliance Validator", "logs": state["workflow_logs"]})
            state = compliance_validator(state)
            
            # Step 2: Brand Tone Validator
            state["workflow_logs"].append("Rerun Validation: Running Brand Tone Validator...")
            db.update_request(request_id, {"current_agent": "Brand Tone Validator", "logs": state["workflow_logs"]})
            state = brand_tone_validator(state)
            
            # Step 3: SEO Intelligence Agent
            state["workflow_logs"].append("Rerun Validation: Running SEO Intelligence Agent...")
            db.update_request(request_id, {"current_agent": "SEO Intelligence Agent", "logs": state["workflow_logs"]})
            state = seo_intelligence_agent(state)
            
            # Step 4: Risk Scoring Engine
            state["workflow_logs"].append("Rerun Validation: Running Risk Scoring Engine...")
            db.update_request(request_id, {"current_agent": "Risk Scoring Engine", "logs": state["workflow_logs"]})
            state = risk_scoring_engine(state)
            
            # Save completed state
            status_dict = _build_status_dict(state, "completed", "Risk Scoring Engine")
            db.update_request(request_id, status_dict)
            
            # Save validated version
            db.add_version(request_id, new_version + 1, state["draft"], "System — Validated", f"Validation rerun complete (v{new_version + 1})")
            
        except Exception as e:
            req = db.get_request(request_id)
            if req:
                logs = req.get("logs", [])
                logs.append(f"Error rerunning validation: {str(e)}")
                db.update_request(request_id, {"status": "failed", "logs": logs, "current_agent": "Error"})

    await asyncio.to_thread(run_pipeline)


@router.post("/{request_id}/rerun")
async def rerun_validation(request_id: str, payload: ResumeRequestInput, background_tasks: BackgroundTasks):
    req = db.get_request(request_id)
    if not req:
        return {"status": "not_found", "message": "Request not found."}

    if req.get("status") not in ["completed", "awaiting_review"]:
        return {"status": "error", "message": "Can only rerun validation on completed or awaiting review drafts."}

    logs = req.get("logs", [])
    logs.append("Human edited and initiated a validation rerun. Launching validation agents...")
    
    # Store edited draft, set status to processing
    db.update_request(request_id, {
        "status": "processing",
        "current_agent": "Compliance Validator",
        "logs": logs,
        "draft_content": payload.edited_draft,
        "edited_draft": payload.edited_draft
    })
    
    # Versioning: increment version count
    current_version = req.get("version", 1)
    new_version = current_version + 1
    db.add_version(request_id, new_version, payload.edited_draft, "Human Reviewer", "Edits applied prior to validation rerun")

    background_tasks.add_task(run_validation_only_pipeline, request_id, payload.edited_draft, new_version)

    return {"status": "processing", "message": "Workflow validation rerun started successfully."}


@router.delete("/{request_id}")
async def delete_request(request_id: str):
    req = db.get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    db.delete_request(request_id)
    return {"status": "success", "message": f"Draft {request_id} has been deleted successfully."}
