import os
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI

# Initialize FastAPI application
app = FastAPI()

# Initialize OpenAI client using environment variables
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Configure Clerk authentication using the JWKS URL from environment variables
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)

# Step 2: Define the Data Model
class TicketRecord(BaseModel):
    """
    Pydantic model that defines the contract between frontend and backend.
    Ensures all incoming tickets have the required fields and correct types.
    """
    ticket_id: str
    reported_by: str
    issue_category: str
    submitted_date: str
    issue_description: str

# Step 3a: Design the System Prompt
# Established as a senior IT specialist to generate three specific output sections.
system_prompt = """
You are a Senior IT Support Specialist and Systems Administrator with over 20 years of experience in enterprise infrastructure, cybersecurity, and deskside support. Your goal is to analyze the provided IT support ticket and generate a comprehensive, professional response divided into exactly three sections.

## Technical Incident Report
In this section, provide a high-level technical analysis intended for internal IT logs and senior engineers. Use precise industry terminology (e.g., latency, packet loss, CMOS, LDAP, registry hives). Describe the probable root cause based on the symptoms provided. Focus on the infrastructure impact, security implications, and hardware/software environment details. This must be a formal record, devoid of any conversational tone.

## Resolution Steps
Generate a prioritized, numbered list of actionable instructions to resolve the issue. For every single step, you must explicitly assign one of the following urgency levels: [Critical], [High], [Medium], or [Low]. Ensure the steps follow a logical troubleshooting methodology (e.g., isolation, testing, verification). Provide specific commands or settings where applicable. The goal is to provide a clear roadmap that a junior technician could follow to close the ticket successfully.

## User Status Email
Draft a professional, empathetic, and jargon-free email addressed directly to the reporter of the ticket. Use a friendly and reassuring tone. Clearly explain the situation in plain English without using complex technical terms. Outline what steps have been taken or what the user needs to do next. Ensure the user feels supported and informed about the expected resolution timeline and the current status of their request.
"""

# Step 3b: User Prompt Function
def user_prompt_for(ticket: TicketRecord) -> str:
    """
    Formats the incoming TicketRecord into a clearly labeled string for the AI model.
    """
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
    # Authenticate the request using Clerk dependency
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    """
    Main endpoint that validates the user, processes the ticket, 
    and streams the AI response back to the client.
    """
    # Extract verified user identity from the JWT
    user_id = creds.decoded["sub"]

    # Construct the message list for the OpenAI Chat Completion API
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt_for(ticket)},
    ]

    # Initialize streaming request to OpenAI
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    )

    # Generator function to handle Server-Sent Events (SSE)
    def event_stream():
        try:
            for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    # Split text on newlines to preserve markdown structure for the frontend
                    lines = text.split("\n")
                    for i, line in enumerate(lines):
                        # Yield each line as a properly formatted SSE event
                        yield f"data: {line}\n\n"
                        # Handle line breaks within the stream
                        if i < len(lines) - 1:
                            yield f"data: \n\n"
            
            # Send a termination signal to notify the client the stream is finished
            yield "data: [DONE]\n\n"
        except Exception as e:
            # Yield error messages as SSE events if the stream fails
            yield f"data: Error during streaming: {str(e)}\n\n"

    # Return a StreamingResponse with the correct SSE media type
    return StreamingResponse(event_stream(), media_type="text/event-stream")