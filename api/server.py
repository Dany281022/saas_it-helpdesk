import os
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str

system_prompt = """
You are a Senior IT Support Specialist. Analyze IT support tickets and produce professional,
structured output in exactly three sections. Follow these instructions carefully:

## Technical Incident Report
Provide a concise, technical summary of the incident suitable for IT records.
Include all relevant symptoms, context, and any system/environment details.
Use professional terminology without explaining to end users.

## Resolution Steps
List numbered, actionable steps to resolve the issue. Assign urgency levels
(Critical / High / Medium / Low) to each step. Ensure clarity and feasibility.

## User Status Email
Write a friendly, plain-English message for the end user.
Explain the issue, what actions are being taken, and any instructions they should follow.
Avoid technical jargon.
"""

def user_prompt_for(ticket: TicketRecord) -> str:
    return (
        f"Ticket ID: {ticket.ticket_id}\n"
        f"Reported By: {ticket.reported_by}\n"
        f"Issue Category: {ticket.issue_category}\n"
        f"Submitted Date: {ticket.submitted_date}\n"
        f"Issue Description: {ticket.issue_description}"
    )

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    user_id = creds.decoded["sub"]

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_for(ticket)},
    ]

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
                    for line in text.split("\n"):
                        yield f"data: {line}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

static_path = Path("static")
if static_path.exists():
    @app.get("/")
    async def serve_root():
        return FileResponse(static_path / "index.html")
    app.mount("/", StaticFiles(directory="static", html=True), name="static")