import os
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI

# Initialize FastAPI application
app = FastAPI()

# Initialize OpenAI client (API key from environment variables)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Configure Clerk authentication with JWKS URL from environment
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)


# ---------------------------------------------------------
# Step 2 — Data Model (The contract between Frontend & Backend)
# ---------------------------------------------------------
class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str


# ---------------------------------------------------------
# Step 3a — System Prompt (Role and Output Structure)
# ---------------------------------------------------------
system_prompt = """
You are a Senior IT Support Specialist working in an enterprise IT department.

Your task is to analyze incoming IT support tickets and produce a professional report.
You MUST produce EXACTLY three sections with the following exact headings.

## Technical Incident Report
Write 2–3 professional paragraphs for IT records explaining:
• The specific technical problem identified
• Possible root causes and affected systems
• Security or productivity impact on the organization

---

## Resolution Steps
Provide a numbered list of troubleshooting steps for a technician.
Each step MUST include:
• A short descriptive title
• A priority label: (**Critical**, **High**, **Medium**, or **Low**)
• Clear, actionable instructions and commands if applicable

Example:
1. **Verify VPN Gateway – Critical**
   - Check status on the firewall dashboard.
   - Command: `ping 10.0.0.1`

---

## User Status Email
**Subject:** [Action Required/Update] Regarding your IT Ticket

Dear [User Name],

Write a polite, jargon-free explanation for the end-user.
Explain what is happening and what the IT team is doing to fix it.
Keep the tone helpful and professional.

Best regards,
IT Support Team

IMPORTANT: 
- Use Markdown for formatting.
- Ensure sections are separated by horizontal rules (---).
- Do not repeat the headings.
"""


# ---------------------------------------------------------
# Step 3b — User Prompt (Injecting runtime data)
# ---------------------------------------------------------
def user_prompt_for(ticket: TicketRecord) -> str:
    """Formats the incoming ticket data into a clear prompt for the AI."""
    return f"""
NEW IT SUPPORT TICKET DATA:
- Ticket ID: {ticket.ticket_id}
- Reported By: {ticket.reported_by}
- Category: {ticket.issue_category}
- Date: {ticket.submitted_date}

Issue Description:
{ticket.issue_description}

Please analyze the data above and generate the three-section report.
"""


# ---------------------------------------------------------
# Step 4 — Backend Endpoint (Streaming & Auth)
# ---------------------------------------------------------
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    """
    Authenticated endpoint that triggers the AI analysis.
    Verified user identity is extracted from the Clerk JWT.
    """
    user_id = creds.decoded["sub"]

    # Prepare messages for OpenAI
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_for(ticket)},
    ]

    # Create a streaming completion
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )

    # -----------------------------------------------------
    # SSE Streaming Generator (Newline handling logic)
    # -----------------------------------------------------
    def event_stream():
        try:
            for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    # To satisfy the "split text on newlines" requirement while 
                    # keeping Markdown valid, we split but ensure data is sent clearly.
                    # SSE format: data: [content]\n\n
                    lines = content.split("\n")
                    for i, line in enumerate(lines):
                        # If there's a real newline, we send it as a separate SSE event
                        yield f"data: {line}\n\n"
            
            # Custom signal to tell the frontend we are finished
            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: Error during streaming: {str(e)}\n\n"

    # Return as text/event-stream for real-time UI updates
    return StreamingResponse(event_stream(), media_type="text/event-stream")