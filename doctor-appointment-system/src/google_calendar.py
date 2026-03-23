import os
import zoneinfo
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, HTMLResponse
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
    
    response = RedirectResponse(url=authorization_url)
    
    # --- NEW: Save the PKCE secret in a temporary 5-minute cookie ---
    if hasattr(flow, 'code_verifier') and flow.code_verifier:
        response.set_cookie(
            key="pkce_verifier", 
            value=flow.code_verifier, 
            httponly=True, 
            max_age=300, 
            secure=True, 
            samesite="lax"
        )
        
    return response

@router.get("/auth/google/callback")
async def google_callback(request: Request, state: str, code: str, session: Session = Depends(get_db)):
    flow = get_google_flow()
    
    # --- NEW: Retrieve the secret from the cookie so Google trusts us ---
    pkce_verifier = request.cookies.get("pkce_verifier")
    if pkce_verifier:
        flow.code_verifier = pkce_verifier

    try:
        flow.fetch_token(code=code)
    except Exception as e:
        print(f"Token Error: {e}")
        return HTMLResponse("""
            <html><body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2 style="color:red;">Connection Error</h2>
            <p>Failed to verify with Google. Please go back and try again.</p>
            <button onclick="window.history.go(-2)" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">Go Back</button>
            </body></html>
        """)

    credentials = flow.credentials
    refresh_token = credentials.refresh_token
    
    if not refresh_token:
        return HTMLResponse("""
            <html><body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>Connected, but no new token received.</h2>
            <p>To generate a new one, go to your Google Account Settings > Third-party apps, remove access, and try again.</p>
            <button onclick="window.history.go(-2)" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">Return to Dashboard</button>
            </body></html>
        """)
    
    doctor = session.query(db.Doctor).filter(db.Doctor.username == state).first()
    if not doctor:
        return HTMLResponse(f"""
            <html><body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2 style="color:red;">Error: Doctor Not Found</h2>
            <p>Could not find your account.</p>
            <button onclick="window.history.go(-2)" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">Return to Dashboard</button>
            </body></html>
        """)
    
    doctor.google_refresh_token = refresh_token 
    session.commit()
    
    # --- NEW: Beautiful Success Page ---
    return HTMLResponse("""
        <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h1 style="color: #16a34a;">✅ Calendar Connected!</h1>
            <p>Your Google Calendar has been successfully linked.</p>
            <p>Click below to return to your Medical Portal.</p>
            <br/>
            <button onclick="window.history.go(-2)" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">
                Return to Dashboard
            </button>
        </body>
        </html>
    """)

# --- Helper Functions ---
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