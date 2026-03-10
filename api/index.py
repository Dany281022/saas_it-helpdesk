import os
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI

app = FastAPI()

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Clerk Auth configuration
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)

# ---------------------------
# Step 2: TicketRecord model
# ---------------------------
class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str  # format YYYY-MM-DD
    issue_description: str

# ---------------------------
# Step 3a: System prompt
# ---------------------------
system_prompt = """
You are a Senior IT Support Specialist. Your role is to analyze incoming IT tickets and provide
professional, structured output in exactly three sections. Follow these instructions carefully:

## Technical Incident Report
Use concise, technical language to describe the problem. Include any relevant context for IT records.
Focus on facts, logs, and observed symptoms. Do not include user-friendly explanations.

## Resolution Steps
Provide a step-by-step guide to resolve the issue. Number each step. Include urgency levels
(Critical / High / Medium / Low) for each step. Steps must be actionable and precise.

## User Status Email
Write a clear, friendly message to the end user. Avoid technical jargon. Explain what happened,
what you are doing, and any instructions they need to follow.
"""

# ---------------------------
# Step 3b: User prompt function
# ---------------------------
def user_prompt_for(ticket: TicketRecord) -> str:
    return (
        f"Ticket ID: {ticket.ticket_id}\n"
        f"Reported By: {ticket.reported_by}\n"
        f"Issue Category: {ticket.issue_category}\n"
        f"Submitted Date: {ticket.submitted_date}\n"
        f"Issue Description: {ticket.issue_description}"
    )

# ---------------------------
# Step 4: Backend endpoint
# ---------------------------
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    user_id = creds.decoded["sub"]  # verified user identity
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
                    # Split lines to send each as an SSE event
                    for line in text.split("\n"):
                        yield f"data: {line}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")