# Step 1: Build the Next.js frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Pass Clerk environment variables required for the build process
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Generate the static export of the frontend
RUN npm run build

# Step 2: Create the final production container
FROM python:3.12-slim
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI backend server logic
COPY api/server.py .

# Copy the static frontend files generated in Step 1 to the /static directory
COPY --from=frontend-builder /app/out ./static

# Health check to ensure the container is running correctly
# It attempts to connect to the /health endpoint every 30 seconds
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Expose the application port
EXPOSE 8000

# Start the application using Uvicorn
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
