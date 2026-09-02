from pydantic import BaseModel
from typing import Optional, List

class ContentRequestInput(BaseModel):
    topic: str
    target_keyword: str
    content_type: str
    project_reference: Optional[str] = None
    target_audience: Optional[str] = None
    source_documents: Optional[str] = None
    brief: Optional[str] = None

class ContentRequestResponse(BaseModel):
    request_id: str
    status: str
    message: str

class WorkflowStateResponse(BaseModel):
    request_id: str
    current_agent: str
    status: str
    logs: List[str]
    draft_content: Optional[str] = None
    risk_scores: Optional[dict] = None
