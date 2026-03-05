import os
from fastapi import FastAPI, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from openai import OpenAI
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials

app = FastAPI()

# Initialize OpenAI
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Clerk Auth Configuration
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)

class ITTicket(BaseModel):
    title: str = Field(..., description="Subject of the IT issue")
    category: str = Field(..., description="Hardware, Software, Network, or Access")
    priority: str = Field(..., description="Low, Medium, High, or Urgent")
    description: str = Field(..., description="Detailed explanation")

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/ticket")
async def resolve_ticket(
    ticket: ITTicket, 
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard)
):
    system_instruction = "You are a Senior IT Support Engineer. Provide a diagnostic, solution, and recommendation."
    
    user_prompt = f"Ticket: {ticket.title}\nCategory: {ticket.category}\nPriority: {ticket.priority}\nDescription: {ticket.description}"

    async def event_generator():
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini", 
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_prompt}
                ],
                stream=True
            )
            for chunk in response:
                if chunk.choices[0].delta.content:
                    yield f"data: {chunk.choices[0].delta.content}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")