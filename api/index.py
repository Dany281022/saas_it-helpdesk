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
# Configure Clerk authentication
# ---------------------------------------------------------
clerk_config = ClerkConfig(
    jwks_url=os.getenv("CLERK_JWKS_URL")
)

clerk_guard = ClerkHTTPBearer(clerk_config)


# ---------------------------------------------------------
# Step 2 — Data Model
# ---------------------------------------------------------
class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str


# ---------------------------------------------------------
# Step 3a — System Prompt
# ---------------------------------------------------------
system_prompt = """
You are a senior IT support specialist working in a corporate enterprise IT department.

Your role is to analyze incoming IT help desk tickets and generate a clear professional report that can be used by both IT staff and the end user. The report must be structured and easy to read. It should follow professional documentation standards used by enterprise IT teams.

You MUST produce exactly three sections using the exact headings below.

## Technical Incident Report
Write a short professional report describing the technical problem. Explain what the issue likely is, what systems may be affected, and possible root causes. Use clear technical language appropriate for IT documentation. Mention any infrastructure, software, or network components that might be involved.

## Resolution Steps
Provide a numbered troubleshooting plan. Each step must include a short title and a priority level such as Critical, High, Medium, or Low. The instructions should be clear enough for an IT technician to follow. Include commands or configuration steps if applicable.

## User Status Email
Write a short email that explains the situation to the user in simple language. Avoid technical jargon. Explain what the IT team is doing and reassure the user that the issue is being investigated.

Always use Markdown formatting for headings and lists. Keep the tone professional and structured.
"""


# ---------------------------------------------------------
# Step 3b — User Prompt
# ---------------------------------------------------------
def user_prompt_for(ticket: TicketRecord) -> str:
    return f"""
IT SUPPORT TICKET DETAILS

Ticket ID: {ticket.ticket_id}
Reported By: {ticket.reported_by}
Issue Category: {ticket.issue_category}
Submitted Date: {ticket.submitted_date}

Issue Description:
{ticket.issue_description}

Analyze this ticket and generate the full IT support report with the required three sections.
"""


# ---------------------------------------------------------
# Step 4 — Backend Endpoint
# ---------------------------------------------------------
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):

    # Verified Clerk user ID
    user_id = creds.decoded["sub"]

    client = OpenAI()

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
    # SSE streaming generator
    # -----------------------------------------------------
    def event_stream():

        for chunk in stream:

            text = chunk.choices[0].delta.content

            if text:

                # split text into lines
                lines = text.split("\n")

                for line in lines:
                    yield f"data: {line}\n\n"


    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )
    