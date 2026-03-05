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

# --- MIDDLEWARE CONFIGURATION ---
# Handling CORS for frontend/backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CLERK AUTHENTICATION CONFIGURATION ---
# Fulfills the "Clerk authentication" requirement
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)

# --- PYDANTIC MODEL ---
# Fulfills the "Pydantic models" requirement for IT Tickets
class ITTicket(BaseModel):
    title: str = Field(..., description="The subject of the technical issue")
    category: str = Field(..., description="Software, Hardware, Network, or Access")
    priority: str = Field(..., description="Low, Medium, High, or Urgent")
    description: str = Field(..., description="Detailed problem description")

# --- AI SYSTEM PROMPT ---
SYSTEM_PROMPT = """
You are a Senior IT Support Engineer. Your goal is to provide technical 
diagnostics and step-by-step resolutions for IT tickets. 
Reply with exactly three sections with the headings:
### Diagnostic
### Solution
### Recommendation
"""

def user_prompt_for(ticket: ITTicket) -> str:
    return f"""Please analyze this ticket:
Subject: {ticket.title}
Category: {ticket.category}
Priority: {ticket.priority}
Description:
{ticket.description}"""

# --- API ENDPOINT ---
# Fulfills the "FastAPI streaming endpoints" requirement
@app.post("/api/ticket")
def resolve_ticket(
    ticket: ITTicket,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    # Verify user identity via Clerk
    user_id = creds.decoded["sub"]
    client = OpenAI() # Uses OPENAI_API_KEY from environment
    
    user_message = user_prompt_for(ticket)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]
    
    # Streaming response using gpt-4o-mini
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )
    
    def event_stream():
        try:
            for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    # Formatting for Server-Sent Events (SSE)
                    yield f"data: {text}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"
    
    return StreamingResponse(event_stream(), media_type="text/event-stream")

# --- HEALTH CHECK ---
# Required for AWS/Docker deployment health monitoring
@app.get("/health")
def health_check():
    return {"status": "healthy"}

# --- STATIC FILES SERVING ---
# Serves the Next.js frontend built in the Docker multistage process
static_path = Path("static")
if static_path.exists():
    @app.get("/")
    async def serve_root():
        return FileResponse(static_path / "index.html")
    
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
    