import os
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI


# ---------------------------------------
# Initialize FastAPI application
# ---------------------------------------
app = FastAPI()


# ---------------------------------------
# Initialize OpenAI client
# API key is loaded from environment variable
# ---------------------------------------
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


# ---------------------------------------
# Configure Clerk authentication
# This verifies the JWT sent from the frontend
# ---------------------------------------
clerk_config = ClerkConfig(
    jwks_url=os.getenv("CLERK_JWKS_URL")
)

clerk_guard = ClerkHTTPBearer(clerk_config)


# ---------------------------------------
# Step 2 — Ticket Data Model
# This model validates incoming request data
# ---------------------------------------
class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str


# ---------------------------------------
# Step 3a — System Prompt
# Defines the structure the AI must follow
# ---------------------------------------
system_prompt = """
You are a Senior IT Support Specialist working in an enterprise IT department.

Your task is to analyze incoming IT support tickets and generate a professional support report.

You MUST follow this exact markdown structure and produce ONLY the following three sections.

## Technical Incident Report
Write 2–3 professional paragraphs explaining:
• the issue
• probable root causes
• affected infrastructure components
• potential productivity or security impact

---

## Resolution Steps
Provide a numbered list of troubleshooting steps.

Each step MUST include:
• a short step title
• a priority level (**Critical**, **High**, **Medium**, **Low**)
• clear instructions
• commands when applicable

Example format:

1. **Verify VPN Gateway – Critical**
   - Check if the VPN gateway is operational
   - Command: `ping <VPN_IP>`

---

## User Status Email

**Subject:** Short professional subject line

Dear [User Name],

Explain the situation in simple, non-technical language.
Inform the user what IT is doing to resolve the issue.

Best regards  
IT Support Team

IMPORTANT RULES:
- Produce exactly THREE sections
- Do NOT repeat headings
- Use clean markdown formatting
"""


# ---------------------------------------
# Step 3b — User Prompt Builder
# Converts the ticket into a readable prompt
# ---------------------------------------
def user_prompt_for(ticket: TicketRecord) -> str:
    return f"""
IT SUPPORT TICKET

Ticket ID: {ticket.ticket_id}
Reported By: {ticket.reported_by}
Issue Category: {ticket.issue_category}
Submitted Date: {ticket.submitted_date}

Issue Description:
{ticket.issue_description}

Analyze this support ticket and produce the structured IT support report.
"""


# ---------------------------------------
# Step 4 — Backend API Endpoint
# Receives ticket data from frontend
# Sends it to OpenAI
# Streams the response back to the client
# ---------------------------------------
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):

    # Extract authenticated Clerk user ID
    user_id = creds.decoded["sub"]

    # Construct messages for the AI model
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_for(ticket)},
    ]

    # Create a streaming request to OpenAI
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )

    # ---------------------------------------
    # SSE Streaming Generator
    # Sends incremental text chunks to frontend
    # ---------------------------------------
    def event_stream():
        try:
            for chunk in stream:
                text = chunk.choices[0].delta.content

                # Only send non-empty content
                if text:
                    yield f"data: {text}\n\n"

            # Signal the frontend that streaming is complete
            yield "data: [DONE]\n\n"

        except Exception as e:
            # Return error message to client if something fails
            yield f"data: Error: {str(e)}\n\n"

    # Return Server-Sent Events stream
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )