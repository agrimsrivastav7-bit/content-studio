import os
import time
from fastapi import APIRouter
from .. import database as db
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from google.generativeai import configure, get_model

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("/")
async def health_check():
    health_status = {"status": "ok", "details": {}}
    
    # 1. Check DB
    try:
        db.get_requests() # Simple read query
        health_status["details"]["database"] = "ok"
    except Exception as e:
        health_status["details"]["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
        
    # 2. Check API Key
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        health_status["details"]["llm_api"] = "error: GOOGLE_API_KEY missing"
        health_status["status"] = "error"
    else:
        try:
            # Check if models are accessible
            configure(api_key=api_key)
            get_model("models/gemini-2.5-flash")
            health_status["details"]["llm_api"] = "ok"
        except Exception as e:
            health_status["details"]["llm_api"] = f"error: {str(e)}"
            health_status["status"] = "error"
            
    # 3. Check ChromaDB
    try:
        db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "chroma_db")
        if not os.path.exists(db_dir):
            health_status["details"]["chroma_db"] = "error: DB directory missing"
            if health_status["status"] == "ok":
                health_status["status"] = "degraded"
        else:
            embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-2")
            vectorstore = Chroma(
                persist_directory=db_dir, 
                embedding_function=embeddings,
                collection_name="dlf_properties"
            )
            count = len(vectorstore.get()["ids"])
            if count == 0:
                health_status["details"]["chroma_db"] = "warning: empty"
            else:
                health_status["details"]["chroma_db"] = f"ok ({count} facts)"
    except Exception as e:
        health_status["details"]["chroma_db"] = f"error: {str(e)}"
        if health_status["status"] == "ok":
            health_status["status"] = "degraded"
            
    return health_status
