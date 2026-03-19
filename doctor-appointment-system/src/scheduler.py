from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import config
import requests
from fastapi import HTTPException


scheduler = BackgroundScheduler()
scheduler.start()

def send_whatsapp_reminder(phone_number: str, doctor_name: str, client_name: str, date: str, time: str):
    url= config.AISENSY_API_URL
    payload = {
        "apikey": config.AISENSY_API_KEY_REMINDER,
        "campaignName": "appointment_reminder",
        "destination": phone_number,
        "userName": client_name,
        "templateParams": [
            client_name, doctor_name, date, time
        ],
        "source": "new-landing-page form",
        "media": {},
        "buttons": [],
        "carouselCards": [],
        "location": {},
        "attributes": {},
        "paramsFallbackValue": {
            "FirstName": "user"
        }
    }
    headers = {"content-type": "application/json"}
    try:
        requests.post(url, json = payload, headers = headers)
    except Exception as e:
        # background jobs cannot raise exceptions, so we log the error instead of raising it
        print(f"Failed to send reminder: {e}")
        # raise HTTPException(status_code=500, detail=f"Failed to send reminder: {e}")
    
def schedule_reminder(apt_id: int,doctor_name: str):
    appointment_time = datetime.combine(apt.booking_date, apt.slot_time)
    run_time = appointment_time - timedelta(hours=3)
    
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
            id = f"reminder_{apt_id}"
        )