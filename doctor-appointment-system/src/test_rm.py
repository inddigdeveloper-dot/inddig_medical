import requests
import config

# def send_whatsapp_reminder(phone_number: str, doctor_name: str, client_name: str, date: str, time: str):
def send_whatsapp_reminder():
    url = config.AISENSY_API_URL
    
    # 1. Format the phone number (Crucial for AiSensy)
    destination_phone=919601041161
    # destination_phone = phone_number.replace("+", "").replace(" ", "").strip()
    # if len(destination_phone) == 10:
    #     destination_phone = f"91{destination_phone}"
        

    payload = {
        "apiKey": config.AISENSY_API_KEY_REMINDER, # Capital 'K' here!
        "campaignName": "appointment_reminder",    # Ensure this exactly matches AiSensy
        "destination": destination_phone,          # Use the formatted number
        "userName": "Test Patient",
        "templateParams": [
            "Test Patient",  # {{1}}
            "Dr. Smith",     # {{2}}
            "25 March 2026", # {{3}}
            "10:00 AM"  
            # str(client_name), 
            # str(doctor_name), 
            # str(date), 
            # str(time)
        ],
        "source": "automated-reminder",
        "media": {},
        "buttons": [],
        "carouselCards": [],
        "location": {},
        "attributes": {},
        "paramsFallbackValue": {
            "FirstName": "user"
        }
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        
        # Log exactly what happens in the background so we aren't blind
        if response.status_code != 200:
            print(f"🚨 Background Reminder Failed for {client_name}: {response.json()}")
        else:
            print(f"✅ Background Reminder Sent to {client_name}!")
            
    except Exception as e:
        # Background jobs cannot raise exceptions to the user, so we log it
        print(f"🚨 Network error sending reminder: {e}")
        
        
if __name__ == "__main__":
    send_whatsapp_reminder()
