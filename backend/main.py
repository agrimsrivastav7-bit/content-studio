import os
from dotenv import load_dotenv

# Load environment variables from backend/.env explicitly
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(backend_dir, ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import requests, health, knowledge, export, analytics
from . import database as db

app = FastAPI(
    title="DLF Content Governance API",
    description="Backend for the AI-assisted content generation platform.",
    version="1.0.0"
)

import os

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000,http://localhost:3001,http://localhost:3005")
allow_origins = [url.strip() for url in frontend_url.split(",")]

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Database
db.init_db()

# Register Routers
app.include_router(requests.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "DLF Content Governance API is running."}
