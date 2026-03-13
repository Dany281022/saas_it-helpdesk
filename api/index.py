import os
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI


app = FastAPI()

# OpenAI client
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Clerk authentication
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
# System Prompt
# ────────────────────────────────────────────────
system_prompt = """
You are a Senior IT Support Specialist working in an enterprise IT department.

Your task is to analyze incoming IT support tickets and produce a professional report.
You MUST produce EXACTLY three sections using the following headings (do not change them):

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
• a priority level in bold (**Critical**, **High**, **Medium**, or **Low**)
• clear instructions
• relevant commands when applicable (use correct syntax for Windows or Linux as appropriate)

Example format:
1. **Verify VPN Service Status – Critical**
   - Check if the service is running
   - Command (Linux): `systemctl status openvpn`

---

## User Status Email

**Subject:** Update Regarding Your IT Support Ticket [Ticket ID]

Dear [Reported By],

Use simple, non-technical language.
Explain what is happening and what the IT team is doing.

Best regards,  
IT Support Team

IMPORTANT RULES:
- Use valid Markdown formatting (## for headings, ** for bold, - or * for lists, 1. for numbered lists)
- Separate the three main sections with --- (horizontal rule)
- Never repeat or change the exact section headings
- Be concise but complete
- For commands: use correct syntax and indicate OS when relevant
"""


# ────────────────────────────────────────────────
# User Prompt
# ────────────────────────────────────────────────
def user_prompt_for(ticket: TicketRecord) -> str:
    return f"""
IT SUPPORT TICKET

Ticket ID:          {ticket.ticket_id}
Reported By:        {ticket.reported_by}
Category:           {ticket.issue_category}
Submitted Date:     {ticket.submitted_date}

Issue Description:
{ticket.issue_description.strip()}

Analyze this ticket carefully and generate the three-section report exactly as instructed.
"""


# ────────────────────────────────────────────────
# API Endpoint
# ────────────────────────────────────────────────
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    user_id = creds.decoded["sub"]  # Clerk user ID

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_prompt_for(ticket)},
    ]

    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7,
        max_tokens=1800,
        stream=True,
    )

    def event_stream():
        try:
            buffer = ""

            for chunk in stream:
                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta
                if delta.content is None:
                    continue

                text = delta.content

                # Nettoyage léger
                text = text.replace("\r", "")

                buffer += text

                # On envoie ligne par ligne quand possible
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    if line.strip():
                        yield f"data: {line}\n\n"

                # Ce qui reste dans le buffer (partiel) → on attend la suite

            # Envoi du reste + fin
            if buffer.strip():
                yield f"data: {buffer}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"
            yield "data: [DONE]\n\n"


    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
    )
    