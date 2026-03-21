import requests
import config

# Put your actual AiSensy API key here
API_KEY=config.AISENSY_API_KEY_WP

# Put your own phone number here (Must start with 91 and have no spaces/pluses)
TEST_PHONE = "919601041161" 

def test_whatsapp():
    url = config.AISENSY_API_URL # Verify this URL in AiSensy docs
    
    payload = {
        "apiKey": API_KEY,
        "campaignName": "appotment_approvement",
        "destination": TEST_PHONE,
        "userName": "Test Patient",
        "templateParams": [
            "Test Patient",  # {{1}}
            "Dr. Smith",     # {{2}}
            "25 March 2026", # {{3}}
            "10:00 AM"       # {{4}}
        ],
        "source": "backend-test",
        "media": {},
        "buttons": [],
        "carouselCards": [],
        "location": {},
        "attributes": {},
        "paramsFallbackValue": {"FirstName": "user"}
    }

    print("Sending request to AiSensy...")
    response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")

if __name__ == "__main__":
    test_whatsapp()