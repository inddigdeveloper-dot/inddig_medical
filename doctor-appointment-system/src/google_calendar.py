import os
import zoneinfo
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build 
from google.oauth2.credentials import Credentials

import database as db
from database import get_db

router = APIRouter()

GOOGLE_REDIRECT_URI = "https://inddigmedical-production.up.railway.app/auth/google/callback"

def get_google_flow():
    return Flow.from_client_config(
        client_config={
            "web": {
                "client_id": os.getenv("CLIENT_ID"),
                "client_secret": os.getenv("CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=['https://www.googleapis.com/auth/calendar.events'],
        redirect_uri=GOOGLE_REDIRECT_URI
    )
    
@router.get("/auth/google/login")
async def google_login(username: str):
    flow = get_google_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent',
        include_granted_scopes='true',
        state=username 
    )
    return {"auth_uri": authorization_url}

@router.get("/auth/google/callback")
async def google_callback(state: str, code: str, session: Session = Depends(get_db)):
    flow = get_google_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials
    
    refresh_token = credentials.refresh_token
    if not refresh_token:
        # If testing, you might need to revoke access in Google Account to see this again
        return {"message": "Connected, but no new refresh token issued. Revoke access and try again if needed."}
    
    doctor = session.query(db.Doctor).filter(db.Doctor.username == state).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    
    doctor.google_refresh_token = refresh_token 
    session.commit()
    return {"message": "Google Calendar connected successfully! You can close this window."}

def get_calendar_service(refresh_token: str):
    creds = Credentials(
        token=None, 
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("CLIENT_ID"),
        client_secret=os.getenv("CLIENT_SECRET")
    )
    return build("calendar", "v3", credentials=creds)

def add_to_calendar(doctor_refresh_token, name, email, doctor_email, booking_date, slot_time, custom_message, user_timezone="UTC"):
    service = get_calendar_service(doctor_refresh_token)

    try:
        patient_tz = zoneinfo.ZoneInfo(user_timezone)
    except Exception:
        patient_tz = zoneinfo.ZoneInfo("UTC")

    local_start = datetime.combine(booking_date, slot_time).replace(tzinfo=patient_tz)
    local_end = local_start + timedelta(minutes=30)

    attendees_list = []
    if email: attendees_list.append({'email': email})
    if doctor_email: attendees_list.append({'email': doctor_email})

    event = {
        'summary': f'Dental Appointment: {name}',
        'description': f'{custom_message}',
        'start': {'dateTime': local_start.isoformat(), 'timeZone': user_timezone},
        'end': {'dateTime': local_end.isoformat(), 'timeZone': user_timezone},
        'attendees': attendees_list,
    }

    try:
        created_event = service.events().insert(calendarId='primary', body=event, sendUpdates='all').execute()
        return created_event.get("htmlLink"), created_event.get("id")
    except Exception as e:
        print(f"Error creating calendar event: {e}")
        raise

def delete_from_calendar_api(doctor_refresh_token, event_id: str):
    service = get_calendar_service(doctor_refresh_token)
    try:
        service.events().delete(calendarId='primary', eventId=event_id, sendUpdates='all').execute()
    except Exception as e:
        print(f"Warning: Could not delete event {event_id}: {e}")