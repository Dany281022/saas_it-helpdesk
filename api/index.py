import os
from typing import Generator

from fastapi import FastAPI, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI


app = FastAPI(title="IT Ticket AI Resolver")

# ────────────────────────────────────────────────
# Clients & Auth
# ────────────────────────────────────────────────
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)


# ────────────────────────────────────────────────
# Data Model
# ────────────────────────────────────────────────
class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str


# ────────────────────────────────────────────────
# Prompts
# ────────────────────────────────────────────────
SYSTEM_PROMPT = """\
You are a Senior IT Support Specialist working in an enterprise IT department.

Your task is to analyze incoming IT support tickets and produce a professional report.
You MUST produce EXACTLY three sections using these exact headings (do not change them):

## Technical Incident Report
Write 2–3 concise, professional paragraphs explaining:
• the technical issue
• likely root causes
• affected systems / infrastructure
• productivity or security/business impact

---

## Resolution Steps
Provide a numbered list of troubleshooting / resolution steps.

Each step MUST include:
• short descriptive title
• priority level in **bold** (**Critical**, **High**, **Medium**, **Low**)
• clear instructions
• relevant commands when appropriate (specify OS when needed)

Example:
1. **Check VPN Service Status – Critical**
   - Verify the service is running on the VPN server
   - Command (Linux): `systemctl status openvpn@server`

---

## User Status Email

**Subject:** Update on Your IT Support Ticket [Ticket ID]

Dear [Reported By],

Use friendly, non-technical language.
Explain the current status and next steps in simple terms.

Best regards,  
IT Support Team

Rules:
- Use correct Markdown: ## headings, **bold**, 1. numbered lists, - bullets
- Separate the three sections with ---
- Never repeat or alter the section headings
- Be concise, accurate and professional
- For commands: use correct syntax and indicate platform (Windows / Linux / macOS)
"""

def user_prompt(ticket: TicketRecord) -> str:
    return f"""\
IT SUPPORT TICKET

Ticket ID:          {ticket.ticket_id}
Reported By:        {ticket.reported_by}
Category:           {ticket.issue_category}
Submitted:          {ticket.submitted_date}

Description:
{ticket.issue_description.strip()}

Analyze this ticket and generate the three-section report exactly as instructed.
"""


# ────────────────────────────────────────────────
# Streaming generator
# ────────────────────────────────────────────────
def generate_sse_events(stream) -> Generator[str, None, None]:
    buffer = ""

    try:
        for chunk in stream:
            if not chunk.choices or chunk.choices[0].delta.content is None:
                continue

            text = chunk.choices[0].delta.content.replace("\r", "")
            buffer += text

            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.rstrip()
                if line:
                    yield f"data: {line}\n\n"

        # Send remaining buffer
        if buffer.strip():
            yield f"data: {buffer.rstrip()}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as exc:
        yield f"data: Error during generation: {str(exc)}\n\n"
        yield "data: [DONE]\n\n"


# ────────────────────────────────────────────────
# Endpoint
# ────────────────────────────────────────────────
@app.post("/api")
async def resolve_ticket(
    ticket: TicketRecord,
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
) -> StreamingResponse:
    # Optional: you can log or rate-limit using user_id
    user_id = creds.decoded.get("sub")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_prompt(ticket)},
    ]

    openai_stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.65,
        max_tokens=1800,
        stream=True,
    )

    return StreamingResponse(
        generate_sse_events(openai_stream),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Content-Type-Options": "nosniff",
        },
    )


# Optional: health check (useful for Vercel / debugging)
@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "it-ticket-resolver"}
    