from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import config
import requests

scheduler = BackgroundScheduler()
scheduler.start()


def send_whatsapp_reminder(phone_number: str, doctor_name: str, client_name: str, date: str, time: str):
    print("\n--- 🛠️ STARTING WHATSAPP BACKGROUND REMINDER DEBUG 🛠️ ---")
    
    url = config.AISENSY_API_URL
    api_key = config.AISENSY_API_KEY_REMINDER
    
    # DEBUG 1: Check if environment variables are actually loaded
    if not url:
        print("🚨 CRITICAL ERROR: config.AISENSY_API_URL is missing! Check your Railway Variables or .env file.")
        return # Stop execution so we don't crash
        
    if not api_key:
        print("🚨 CRITICAL ERROR: config.AISENSY_API_KEY_REMINDER is missing! Check your Railway Variables or .env file.")
        return

    # DEBUG 2: Check phone number formatting
    destination_phone = phone_number.replace("+", "").replace(" ", "").strip()
    if len(destination_phone) == 10:
        destination_phone = f"91{destination_phone}"
        
    print(f"👉 Target URL: {url}")
    print(f"👉 Formatted Phone: {destination_phone}")
    print(f"👉 Using API Key: {api_key[:10]}... (truncated for security)")

    payload = {
        "apiKey": api_key,
        "campaignName": "appointment_reminder",    # Ensure this exactly matches AiSensy
        "destination": destination_phone,          
        "userName": client_name,
        "templateParams": [
            str(client_name), 
            str(doctor_name), 
            str(date), 
            str(time)
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
        print(f"👉 Sending background reminder payload to AiSensy for {client_name}...")
        # Added a 10-second timeout so the background thread doesn't hang forever
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        # DEBUG 3: Catch API rejections specifically
        if response.status_code != 200:
            print(f"🚨 AiSensy API REJECTED the reminder request!")
            print(f"🚨 Status Code: {response.status_code}")
            print(f"🚨 Exact Error Reason: {response.text}")
        else:
            print(f"✅ Background Reminder Sent Successfully to {client_name}! Response: {response.json()}")
               
    # Catch internet/network issues
    except requests.exceptions.RequestException as req_err:
        print(f"🚨 Network Error (Could not reach AiSensy for reminder): {req_err}")
    # Catch python coding errors
    except Exception as e:
        print(f"🚨 General Python Error in background reminder: {e}")

    print("--- 🛠️ END WHATSAPP BACKGROUND REMINDER DEBUG 🛠️ ---\n")
    
    

# 2. Changed signature to accept the full 'apt' object, not just the ID
def schedule_reminder(apt, doctor_name: str):
    appointment_time = datetime.combine(apt.booking_date, apt.slot_time)
    
    # Schedule for 3 hours before the appointment
    run_time = appointment_time - timedelta(hours=3)
    
    # Only schedule if the run_time is in the future
    if run_time > datetime.now():
        scheduler.add_job(
            func=send_whatsapp_reminder,
            trigger='date',
            run_date=run_time,
            args=[
                apt.whatsapp_no,
                doctor_name,
                apt.client_name,
                apt.booking_date.strftime("%d %b %Y"),
                apt.slot_time.strftime("%I:%M %p")
            ],
            id=f"reminder_{apt.id}",
            replace_existing=True # Prevents errors if doctor reschedules an existing appt
        )
        print(f"📅 Reminder scheduled for {apt.client_name} at {run_time}")
    else:
        print(f"⚠️ Appointment for {apt.client_name} is too soon (under 3 hours). No reminder scheduled.")