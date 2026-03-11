import os
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI

# Initialize FastAPI application
app = FastAPI()

# Initialize OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Configure Clerk authentication
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)


# -----------------------------
# Step 2 — Data Model
# -----------------------------
class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str


# -----------------------------
# Step 3a — System Prompt
# -----------------------------
system_prompt = """
You are a Senior IT Support Specialist working in an enterprise IT department.

Your task is to analyze incoming IT support tickets and produce a professional report.

You MUST follow this exact markdown structure and produce ONLY these three sections.

## Technical Incident Report
Write 2–3 professional paragraphs explaining:
• the problem
• possible root causes
• affected systems or infrastructure
• potential productivity or security impact

---

## Resolution Steps
Provide a numbered list of troubleshooting steps.

Each step MUST contain:
• a short title
• a priority label (**Critical**, **High**, **Medium**, **Low**)
• clear actionable instructions
• commands when relevant

Example format:

1. **Verify VPN Gateway – Critical**
   - Check if the VPN gateway is operational
   - Command: `ping <VPN_IP>`

---

## User Status Email

**Subject:** Short professional subject

Dear [User Name],

Write a polite explanation in simple language for the user.
Avoid technical jargon. Explain what the problem is and what IT is doing to resolve it.

Best regards  
IT Support Team

IMPORTANT RULES:
- Produce exactly THREE sections
- Do NOT repeat headings
- Use clean markdown formatting
"""


# -----------------------------
# Step 3b — User Prompt
# -----------------------------
def user_prompt_for(ticket: TicketRecord) -> str:
    return f"""
IT SUPPORT TICKET

Ticket ID: {ticket.ticket_id}
Reported By: {ticket.reported_by}
Issue Category: {ticket.issue_category}
Submitted Date: {ticket.submitted_date}

Issue Description:
{ticket.issue_description}

Please analyze this ticket and generate the structured IT support report.
"""


# -----------------------------
# Step 4 — Backend Endpoint
# -----------------------------
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    # Verified Clerk user
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

    # -----------------------------
    # SSE Streaming Generator
    # -----------------------------
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
    