# config.py
import os 
from dotenv import load_dotenv

# LOAD THE ENV FILE FIRST!
load_dotenv()

# 1. CORS Configuration
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://inddigdeveloper-dot.github.io"
    "https://app.makeappointments.in"
]

# 2. Frontend Base URLs
FRONTEND_BOOKING_BASE_URL = "https://inddigdeveloper-dot.github.io/inddig_medical/#/book"

# 3. Third-Party API Endpoints
AISENSY_API_URL = "https://backend.aisensy.com/campaign/t1/api/v2"
AISENSY_API_KEY_WP = os.getenv("AISENSY_API_KEY_WP")
AISENSY_API_KEY_OTP = os.getenv("AISENSY_API_KEY_OTP")
AISENSY_API_KEY_REMINDER = os.getenv("AISENSY_API_KEY_REMINDER")
