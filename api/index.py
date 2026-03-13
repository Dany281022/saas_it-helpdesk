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
# Initialize OpenAI client (API key from environment variables)
# ---------------------------------------------------------
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


# ---------------------------------------------------------
# Configure Clerk authentication using JWKS URL
# This validates the JWT sent from the frontend
# ---------------------------------------------------------
clerk_config = ClerkConfig(
    jwks_url=os.getenv("CLERK_JWKS_URL")
)

clerk_guard = ClerkHTTPBearer(clerk_config)


# ---------------------------------------------------------
# Step 2 — Data Model
# Defines the structure of incoming ticket data
# ---------------------------------------------------------
class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str


# ---------------------------------------------------------
# Step 3a — System Prompt
# Defines the role of the AI and required output structure
# ---------------------------------------------------------
system_prompt = """
You are a Senior IT Support Specialist working in an enterprise IT department.

Your task is to analyze incoming IT support tickets and produce a professional report.
You MUST produce EXACTLY three sections using the following headings.

## Technical Incident Report
Write 2–3 professional paragraphs explaining:
• the technical issue
• possible root causes
• affected systems or infrastructure
• potential productivity or security impact

---

## Resolution Steps
Provide a numbered list of troubleshooting steps.

Each step MUST include:
• a short title
• a priority level (**Critical**, **High**, **Medium**, or **Low**)
• clear instructions
• commands when applicable

Example:

1. **Verify VPN Gateway – Critical**
   - Check gateway status
   - Command: `ping 10.0.0.1`

---

## User Status Email

**Subject:** Update Regarding Your IT Support Ticket

Dear [User Name],

Explain the situation in simple language without technical jargon.
Describe what the IT team is doing to resolve the issue.

Best regards  
IT Support Team

IMPORTANT RULES:
- Use Markdown formatting.
- Separate sections with horizontal rules (---).
- Do NOT repeat section headings.
"""


# ---------------------------------------------------------
# Step 3b — User Prompt
# Injects ticket data into the AI request
# ---------------------------------------------------------
def user_prompt_for(ticket: TicketRecord) -> str:
    """Format the ticket data into a structured prompt for the AI model."""
    return f"""
IT SUPPORT TICKET

Ticket ID: {ticket.ticket_id}
Reported By: {ticket.reported_by}
Category: {ticket.issue_category}
Submitted Date: {ticket.submitted_date}

Issue Description:
{ticket.issue_description}

Analyze this ticket and produce the structured IT support report.
"""


# ---------------------------------------------------------
# Step 4 — Backend Endpoint
# Handles authenticated ticket analysis requests
# ---------------------------------------------------------
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    """
    Authenticated endpoint that sends ticket data to OpenAI
    and streams the AI response back to the frontend using SSE.
    """

    # Extract authenticated user ID from Clerk JWT
    user_id = creds.decoded["sub"]

    # Prepare messages for OpenAI
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_for(ticket)},
    ]

    # Create streaming request to OpenAI
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )


    # -----------------------------------------------------
    # SSE Streaming Generator
    # Streams AI output incrementally to the frontend
    # -----------------------------------------------------
    def event_stream():
        try:
            for chunk in stream:
                text = chunk.choices[0].delta.content

                if text:
                    # Clean streaming artifacts
                    cleaned_text = text.replace("\r", "")

                    # Split by newline to respect SSE event format
                    lines = cleaned_text.split("\n")

                    for line in lines:
                        yield f"data: {line}\n\n"

            # Signal completion to the frontend
            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: Error during streaming: {str(e)}\n\n"


    # Return response as Server-Sent Events
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )
    