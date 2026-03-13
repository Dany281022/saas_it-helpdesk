import os
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI


# ---------------------------------------------------------
# Initialize FastAPI application
# ---------------------------------------------------------
app = FastAPI()


# ---------------------------------------------------------
# Initialize OpenAI client
# ---------------------------------------------------------
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


# ---------------------------------------------------------
# Clerk Authentication
# ---------------------------------------------------------
clerk_config = ClerkConfig(
    jwks_url=os.getenv("CLERK_JWKS_URL")
)

clerk_guard = ClerkHTTPBearer(clerk_config)


# ---------------------------------------------------------
# Ticket Data Model
# ---------------------------------------------------------
class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str


# ---------------------------------------------------------
# System Prompt
# ---------------------------------------------------------
system_prompt = """
You are a Senior IT Support Specialist working in an enterprise IT department.

Your task is to analyze incoming IT support tickets and produce a professional report.

You MUST produce EXACTLY three sections using these headings:

## Technical Incident Report
Write 2–3 paragraphs explaining:
- the technical issue
- possible root causes
- affected systems
- business impact

---

## Resolution Steps
Provide a numbered troubleshooting list.

Each step must include:
- title
- priority level (Critical, High, Medium, Low)
- instructions
- commands when relevant

---

## User Status Email

Subject: Update Regarding Your IT Support Ticket

Write a simple explanation for the user without technical jargon.

IMPORTANT RULES:
- Use Markdown formatting.
- Separate sections with --- lines.
"""


# ---------------------------------------------------------
# User Prompt Builder
# ---------------------------------------------------------
def user_prompt_for(ticket: TicketRecord) -> str:

    return f"""
IT SUPPORT TICKET

Ticket ID: {ticket.ticket_id}
Reported By: {ticket.reported_by}
Category: {ticket.issue_category}
Submitted Date: {ticket.submitted_date}

Issue Description:
{ticket.issue_description}

Analyze the ticket and produce the structured report.
"""


# ---------------------------------------------------------
# API Endpoint
# ---------------------------------------------------------
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):

    # Extract authenticated user
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


    # -----------------------------------------------------
    # SSE Streaming
    # -----------------------------------------------------
    def event_stream():

        try:

            for chunk in stream:

                text = chunk.choices[0].delta.content

                if text:
                    yield f"data: {text}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:

            yield f"data: Error: {str(e)}\n\n"


    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )
    