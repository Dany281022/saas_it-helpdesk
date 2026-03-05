import os
from pathlib import Path
from fastapi import FastAPI, Depends, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI

app = FastAPI()

# CORS Middleware for local testing and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clerk Configuration
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)

class ITTicket(BaseModel):
    title: str = Field(..., description="Subject of the IT issue")
    category: str = Field(..., description="Hardware, Software, Network, or Access")
    priority: str = Field(..., description="Low, Medium, High, or Urgent")
    description: str = Field(..., description="Detailed explanation")

@app.post("/api/ticket")
def resolve_ticket(
    ticket: ITTicket,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    client = OpenAI()
    
    # Instruction système renforcée pour le rendu "Fiche Technique"
    system_instruction = (
        "You are a Senior IT Support Engineer. "
        "Structure your response strictly with these headers in English:\n"
        "### NATURE OF DIAGNOSTIC\n"
        "(Identify the technical field)\n\n"
        "### TECHNICAL SUMMARY\n"
        "(One sentence summary)\n\n"
        "### RESOLUTION STEPS\n"
        "(Step-by-step instructions)\n\n"
        "### FINAL RECOMMENDATION\n"
        "(Pro-tip for prevention)"
    )
    
    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": f"Issue: {ticket.title}\nCategory: {ticket.category}\nPriority: {ticket.priority}\nDesc: {ticket.description}"},
    ]
    
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )
    
    def event_stream():
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield f"data: {chunk.choices[0].delta.content}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Serve Next.js static files (Essential for Docker build)
# Ce bloc est crucial pour ton déploiement via Dockerfile
static_path = Path("static")
if static_path.exists():
    @app.get("/")
    async def serve_root():
        return FileResponse(static_path / "index.html")
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
    