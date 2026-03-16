import requests

# Make sure your FastAPI server is running on port 8000!
BASE_URL = "http://127.0.0.1:8000"

fake_doctors = [
    {"username": "dr_vijay_dental", "password": "SecurePassword123!"},
    {"username": "dr_sarah_cardio", "password": "HeartHealth2026"},
    {"username": "dr_patel_peds", "password": "KidsCare#99"},
    {"username": "dr_lee_derma", "password": "ClearSkin4Ever"}
]

for doctor in fake_doctors:
    response = requests.post(f"{BASE_URL}/doctor/register", json=doctor)
    
    if response.status_code == 200:
        print(f"Success! {doctor['username']} registered.")
        print(f"Link: {response.json().get('booking_link')}\n")
    else:
        print(f"Failed to register {doctor['username']}: {response.text}\n")