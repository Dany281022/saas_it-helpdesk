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
# ---------------------------------------------------------
clerk_config = ClerkConfig(
    jwks_url=os.getenv("CLERK_JWKS_URL")
)

clerk_guard = ClerkHTTPBearer(clerk_config)


# ---------------------------------------------------------
# Data Model
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

When given a support ticket, you MUST generate a report using EXACTLY this structure, with NO deviation:



## Technical Incident Report

**Ticket ID:** [ticket_id]
**Reported By:** [reported_by]
**Category:** [issue_category]
**Date:** [submitted_date]

**Summary:**
[2–3 sentences describing the reported issue, the affected users, and the probable root cause.]

**Affected Systems:**
[List the systems, clients, or infrastructure impacted.]

**Business Impact:**
[Describe productivity and security risks concisely.]



## Resolution Steps

1. **[Step Title] – Critical**
   - [What to check or do]
   - Command: `[terminal command or UI instruction]`

2. **[Step Title] – High**
   - [What to check or do]
   - Command: `[terminal command or UI instruction]`

3. **[Step Title] – Medium**
   - [What to check or do]
   - Command: `[terminal command or UI instruction]`

[Continue with all necessary steps, each with an appropriate priority: Critical / High / Medium / Low]



## User Status Email

**Subject:** Update Regarding Your IT Support Ticket

Dear [reported_by],

[Paragraph 1: Acknowledge the issue and confirm the team is aware, in plain language.]

[Paragraph 2: Brief explanation of what is being done, without technical jargon.]

Best regards,
IT Support Team



IMPORTANT RULES:
- Always produce all three sections in the exact order above.
- Each section MUST be preceded by a blank line divider on its own line, then a blank line, then the ## heading.
- The header block (Ticket ID → Business Impact) must have NO extra blank lines between fields.
- Resolution steps MUST be numbered and each MUST include a priority level.
- The email MUST be written in simple, non-technical language for an end user.
- Do NOT wrap the output in a code block.
- Do NOT add any introductory sentence or commentary before the report.
- Do NOT add any closing sentence or commentary after the report.
"""


# ---------------------------------------------------------
# User Prompt
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

Analyze this ticket and produce the structured IT support report.
"""


# ---------------------------------------------------------
# Backend Endpoint
# ---------------------------------------------------------
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

    # ---------------------------------------------------------
    # FIX: Do NOT split chunks by "\n" — this was fragmenting
    # dates (e.g. "2026-03-13" → "202", "6", "-03", "-13")
    # and breaking mid-word tokens across SSE events.
    #
    # Instead, send each raw chunk as a single SSE event,
    # using a custom delimiter (__NL__) to encode newlines.
    # The frontend decodes __NL__ back into real newlines.
    # This avoids the SSE \n\n frame-boundary conflict while
    # preserving the full structure of the streamed markdown.
    # ---------------------------------------------------------
    def event_stream():
        try:
            for chunk in stream:
                text = chunk.choices[0].delta.content

                if text:
                    # Encode newlines as a safe delimiter instead of splitting
                    encoded = text.replace("\r\n", "\n").replace("\r", "\n")
                    encoded = encoded.replace("\n", "__NL__")
                    yield f"data: {encoded}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: Error during streaming: {str(e)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )