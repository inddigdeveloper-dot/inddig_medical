# config.py

# 1. CORS Configuration (Who is allowed to talk to your backend?)
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://inddigdeveloper-dot.github.io"
]

# 2. Frontend Base URLs (Used for generating links)
FRONTEND_BOOKING_BASE_URL = "https://inddigdeveloper-dot.github.io/inddig_medical/#/book"

# 3. Third-Party API Endpoints
AISENSY_API_URL = "https://backend.aisensy.com/campaign/t1/api/v2"