from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import config
import requests

scheduler = BackgroundScheduler()
scheduler.start()

def send_whatsapp_reminder(phone_number: str, doctor_name: str, client_name: str, date: str, time: str):
    url = config.AISENSY_API_URL
    
    # 1. Format the phone number (Crucial for AiSensy)
    destination_phone = phone_number.replace("+", "").replace(" ", "").strip()
    if len(destination_phone) == 10:
        destination_phone = f"91{destination_phone}"

    payload = {
        "apiKey": config.AISENSY_API_KEY_REMINDER, # Capital 'K' here!
        "campaignName": "appointment_reminder",    # Ensure this exactly matches AiSensy
        "destination": destination_phone,          # Use the formatted number
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
        response = requests.post(url, json=payload, headers=headers)
        
        # Log exactly what happens in the background so we aren't blind
        if response.status_code != 200:
            print(f"🚨 Background Reminder Failed for {client_name}: {response.json()}")
        else:
            print(f"✅ Background Reminder Sent to {client_name}!")
            
    except Exception as e:
        # Background jobs cannot raise exceptions to the user, so we log it
        print(f"🚨 Network error sending reminder: {e}")

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