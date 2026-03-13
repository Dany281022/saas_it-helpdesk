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
# Step 3a — System Prompt (Optimisé pour le formatage)
# ---------------------------------------------------------
system_prompt = """
You are a senior IT support specialist. Your reports must be perfectly structured.

You MUST produce exactly three sections using the exact headings below.

## Technical Incident Report
Describe the problem, affected systems, and root causes professionally.

---

## Resolution Steps
For this section, you MUST follow this strict format for each step:
1. The step title and priority MUST be on their own line and in **BOLD**.
2. The description or commands MUST be on a new line below the title.

Example:
1. **Verify VPN Server Status – Critical**
Check the service logs on the gateway.

2. **Update Network Drivers – High**
Download the latest drivers from the manufacturer.

---

## User Status Email
Write a professional email. The signature MUST be formatted with each element on a new line and in **BOLD** at the very end.

Example signature format:
**Best regards,**
**IT Support Team**
**Enterprise Services**

Always use Markdown. Ensure there is a double line break between paragraphs.
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

Generate the full report. Make sure the Resolution Steps titles and the Email Signature are on their own lines and bolded.
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
    # SSE streaming generator (Correction du flux Markdown)
    # -----------------------------------------------------
    def event_stream():
        try:
            for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    # On envoie le texte brut sans le splitter inutilement.
                    # Cela permet au composant ReactMarkdown de lire les \n naturels.
                    yield f"data: {text}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )
    