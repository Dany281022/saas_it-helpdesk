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

# Step 2: Data Model
class TicketRecord(BaseModel):
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str

# Step 3a: Design the System Prompt (Strict Structure)
system_prompt = """
You are a Senior IT Support Specialist. Analyze the ticket and provide a response STRICTLY following this markdown structure:

## Technical Incident Report
[Provide a 2-3 paragraph technical analysis using professional terminology. Mention probable root causes and affected infrastructure components.]

---

## Resolution Steps
[Provide a numbered list. Each step MUST include a priority: **Critical**, **High**, **Medium**, or **Low**.]

1. **Step Name – Priority**
   - Actionable instruction.
   - Command (if applicable): ```command```

---

## User Status Email
**Subject:** [Professional Subject Line]

Dear [User Name],

[A polite, jargon-free explanation for the user. Outline the current status and next steps.]

Best regards,
IT Support Team
"""

# Step 3b: User Prompt Function
def user_prompt_for(ticket: TicketRecord) -> str:
    return (
        f"--- INCOMING SUPPORT TICKET ---\n"
        f"TICKET ID: {ticket.ticket_id}\n"
        f"REPORTER: {ticket.reported_by}\n"
        f"CATEGORY: {ticket.issue_category}\n"
        f"DATE SUBMITTED: {ticket.submitted_date}\n"
        f"DESCRIPTION: {ticket.issue_description}\n"
        f"--- END OF TICKET ---"
    )

# Step 4: Build the Backend Endpoint
@app.post("/api")
def resolve_ticket(
    ticket: TicketRecord,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    # Extract user identity
    user_id = creds.decoded["sub"]

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_for(ticket)},
    ]

    # Initialize streaming request
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )

    def event_stream():
        try:
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    # Nettoyage des retours à la ligne pour le format SSE
                    # On remplace les sauts de ligne réels par une convention que le front gère
                    yield f"data: {text}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error during streaming: {str(e)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")