import os
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from openai import OpenAI

app = FastAPI()

# Initialize OpenAI client with API Key from environment variables
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# Pydantic model to validate the incoming IT ticket data
# This fulfills the "Pydantic models" requirement of the assignment
class ITTicket(BaseModel):
    title: str = Field(..., description="The subject of the IT issue")
    category: str = Field(..., description="Hardware, Software, Network, or Access")
    priority: str = Field(..., description="Low, Medium, High, or Urgent")
    description: str = Field(..., description="Detailed explanation of the problem")

@app.post("/api/ticket")
async def resolve_ticket(ticket: ITTicket, request: Request):
    """
    Endpoint that receives an IT ticket and streams an AI-generated solution.
    Fulfills the "FastAPI streaming endpoints" requirement.
    """
    
    # System prompt to define the AI's persona as a Senior IT Support Engineer
    system_instruction = (
        "You are a Senior IT Support Engineer. Your goal is to provide technical "
        "diagnostics and step-by-step resolutions for IT tickets. "
        "Be professional, clear, and prioritize safety (especially for hardware)."
    )

    # Structured prompt for the specific ticket
    user_prompt = f"""
    Please analyze the following IT Ticket and provide a structured response:

    ### Diagnostic
    Based on the category '{ticket.category}' and the priority '{ticket.priority}', 
    explain what is likely causing the issue: "{ticket.title}".

    ### Solution
    Provide a clear, numbered list of steps to resolve the issue described:
    "{ticket.description}"

    ### Recommendation
    Suggest one long-term preventative measure to avoid this issue in the future.
    """

    async def event_generator():
        try:
            # Call OpenAI with streaming enabled
            response = client.chat.completions.create(
                model="gpt-4o-mini", 
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_prompt}
                ],
                stream=True
            )
            
            # Iterate through the chunks of the response
            for chunk in response:
                if chunk.choices[0].delta.content:
                    # Format as Server-Sent Events (SSE)
                    yield f"data: {chunk.choices[0].delta.content}\n\n"
            
            # Signal the end of the stream
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            yield f"data: Error during AI generation: {str(e)}\n\n"

    # Return the stream to the React frontend
    return StreamingResponse(event_generator(), media_type="text/event-stream")

    