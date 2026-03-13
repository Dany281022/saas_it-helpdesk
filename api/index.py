import os
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI


# FastAPI is the web framework that handles incoming HTTP requests.
# It automatically validates request bodies, generates API docs,
# and makes it easy to add dependencies like authentication.
app = FastAPI()


# The OpenAI client is initialized once at startup using the API key
# stored in an environment variable. Storing secrets in environment
# variables (not in code) is a security best practice — if the key
# were hardcoded, it would be exposed in version control.
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


# Clerk is our authentication provider. It issues JWT tokens to
# signed-in users on the frontend. The ClerkConfig points to the
# JWKS (JSON Web Key Set) URL, which contains the public keys
# needed to verify that a token was genuinely signed by Clerk
# and has not been tampered with.
clerk_config = ClerkConfig(
    jwks_url=os.getenv("CLERK_JWKS_URL")
)

# ClerkHTTPBearer is a FastAPI dependency that extracts the Bearer
# token from the Authorization header and validates it against the
# JWKS. If the token is missing or invalid, it automatically returns
# a 401 Unauthorized response before the endpoint logic runs.
clerk_guard = ClerkHTTPBearer(clerk_config)


# Pydantic's BaseModel defines the exact shape of data the backend
# expects. FastAPI uses this model to automatically validate every
# incoming request — if a required field is missing or has the wrong
# type, FastAPI returns a 422 Unprocessable Entity error without
# any extra code needed. This is the contract between frontend and backend.
class TicketRecord(BaseModel):
    ticket_id: str        # Short identifier, e.g. TKT-20240312-001
    reported_by: str      # Name or employee ID of the reporter
    issue_category: str   # Category: Network, Hardware, Software, Access, Email, or Other
    submitted_date: str   # Date in YYYY-MM-DD format (kept as str to avoid timezone issues)
    issue_description: str  # Full problem description entered by the reporter


# The system prompt establishes the AI's role, audience, and required
# output structure. Putting instructions here (rather than in the user
# prompt) is more effective because the model treats system messages
# as persistent context — it "remembers" the role and format rules
# throughout the entire response, regardless of what the user says.
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
- Each section MUST be preceded by a blank line, then the ## heading.
- The header block (Ticket ID → Business Impact) must have NO extra blank lines between fields.
- Resolution steps MUST be numbered and each MUST include a priority level.
- The email MUST be written in simple, non-technical language for an end user.
- Do NOT wrap the output in a code block.
- Do NOT add any introductory sentence or commentary before the report.
- Do NOT add any closing sentence or commentary after the report.
"""


# The user prompt function injects the actual ticket data at runtime.
# Using f-strings lets us embed each field with a clear label so the
# model can reliably distinguish ticket_id from reported_by, for example.
# Without labels, the model might confuse the fields and produce incorrect output.
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


# This is the main endpoint. The Depends(clerk_guard) parameter means
# FastAPI will run the Clerk authentication check before executing any
# of the code inside this function. If the JWT is missing or invalid,
# the request is rejected automatically — the endpoint body never runs.
# This is the actual security enforcement layer for our paid SaaS product.
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    # Extract the authenticated user's ID from the verified JWT payload.
    # "sub" (subject) is the standard JWT claim for the user identifier.
    # We have it available here for logging or usage tracking if needed.
    user_id = creds.decoded["sub"]

    # Build the messages list that OpenAI expects:
    # - "system" sets the AI's persistent role and output rules
    # - "user" provides the actual ticket data for this specific request
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_for(ticket)},
    ]

    # Request a streaming completion from OpenAI. With stream=True,
    # the API sends tokens incrementally as they are generated rather
    # than waiting for the full response. This allows the frontend to
    # display text progressively, improving perceived performance.
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )

    # This generator function yields SSE (Server-Sent Events) formatted
    # chunks to the frontend. Each chunk is prefixed with "data: " and
    # terminated with "\n\n" as required by the SSE protocol.
    #
    # IMPORTANT: We do NOT split chunks by "\n" here. The original approach
    # of splitting on newlines was fragmenting dates like "2026-03-13" into
    # separate SSE events ("202", "6", "-03", "-13"), breaking the output.
    # Instead, we encode newlines as "__NL__" so each chunk is sent as a
    # single SSE event. The frontend decodes "__NL__" back into real newlines.
    def event_stream():
        try:
            for chunk in stream:
                text = chunk.choices[0].delta.content

                if text:
                    # Normalize line endings first, then encode as safe delimiter
                    encoded = text.replace("\r\n", "\n").replace("\r", "\n")
                    encoded = encoded.replace("\n", "__NL__")
                    yield f"data: {encoded}\n\n"

            # Send a [DONE] signal so the frontend knows the stream has ended
            # and can stop the loading spinner.
            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: Error during streaming: {str(e)}\n\n"

    # StreamingResponse sends the generator output incrementally to the client
    # using the text/event-stream media type (the SSE standard).
    # This is why we use StreamingResponse instead of JSONResponse —
    # JSONResponse would wait for the entire AI response before sending anything,
    # forcing the user to stare at a blank screen for several seconds.
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )