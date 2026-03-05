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
    # Instruction système renforcée pour un formatage professionnel "Fiche technique"
    system_instruction = (
        "You are a Senior IT Support Engineer. "
        "Structure your response strictly with these headers in English:\n"
        "### NATURE OF DIAGNOSTIC\n"
        "(Identify the technical field)\n\n"
        "### TECHNICAL SUMMARY\n"
        "(One sentence summary)\n\n"
        "### RESOLUTION STEPS\n"
        "(Step-by-step instructions)\n\n"
        "### FINAL RECOMMENDATION\n"
        "(Pro-tip for prevention)"
    )
    
    user_prompt = (
        f"ISSUE: {ticket.title}\n"
        f"CATEGORY: {ticket.category}\n"
        f"PRIORITY: {ticket.priority}\n"
        f"DESCRIPTION: {ticket.description}"
    )

    async def event_generator():
        try:
            # Utilisation de gpt-4o-mini pour la rapidité du streaming
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
                    # Envoi direct du contenu pour le streaming
                    yield f"data: {chunk.choices[0].delta.content}\n\n"
            
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
    