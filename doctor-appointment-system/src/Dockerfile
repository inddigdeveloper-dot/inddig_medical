FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Adjust 'main:app' based on your framework (FastAPI/Flask)
# Assuming FastAPI on port 8000
EXPOSE 8000
CMD ["python", "main.py"]