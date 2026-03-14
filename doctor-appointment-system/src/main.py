import os
import zoneinfo
from datetime import datetime, timedelta, date, time

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from googleapiclient.discovery import build 
from google.oauth2.credentials import Credentials

import database as db

# Load environment variables when the server starts
load_dotenv()

app = FastAPI(title="Doctor Appointment System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,  
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Dependencies ---
def get_db():
    session = db.SessionLocal()
    try:
        yield session
    finally:
        session.close()


# --- Google Calendar Services ---
def get_service_calendar():
    creds = Credentials(
        token=None,
        refresh_token=os.getenv("REFRESH_TOKEN"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("CLIENT_ID"),
        client_secret=os.getenv("CLIENT_SECRET")
    )
    return build('calendar', 'v3', credentials=creds)

def add_to_calendar(name, email, booking_date, slot_time, custom_message, user_timezone="UTC"):
    service = get_service_calendar()

    # 1. Setup timezones using modern zoneinfo
    try:
        patient_tz = zoneinfo.ZoneInfo(user_timezone)
    except Exception:
        patient_tz = zoneinfo.ZoneInfo("UTC")

    # 2. Combine DB date/time into a localized datetime
    local_start = datetime.combine(booking_date, slot_time).replace(tzinfo=patient_tz)
    local_end = local_start + timedelta(minutes=30)

    # 3. Format the event body
    time_str = local_start.strftime('%I:%M %p')
    event = {
        'summary': f'Dental Appointment: {name}',
        'description': f'{custom_message}\n\nNote: This is {time_str} in your time ({user_timezone})',
        'start': {'dateTime': local_start.isoformat(), 'timeZone': user_timezone},
        'end': {'dateTime': local_end.isoformat(), 'timeZone': user_timezone},
        'attendees': [{'email': email}]
    }

    # 4. Execute the insert
    try:
        created_event = service.events().insert(calendarId='primary', body=event, sendUpdates='all').execute()
        return created_event.get("htmlLink"), created_event.get("id")  # Return both the link and the event ID
    except Exception as e:
        print(f"Error creating calendar event: {e}")
        raise

# Helper function to delete from calendar
def delete_from_calendar_api(event_id: str):
    service = get_service_calendar()
    try:
        # sendUpdates='all' sends a cancellation email to the patient automatically
        service.events().delete(calendarId='primary', eventId=event_id, sendUpdates='all').execute()
    except Exception as e:
        print(f"Warning: Could not delete event {event_id} from Google Calendar: {e}")


# --- Pydantic Schemas ---
class AppointmentRequest(BaseModel):
    client_name: str
    client_email: EmailStr
    mobile_no: str 
    slot_time: str
    user_timezone: str = "UTC"  

class AppointmentUpdate(BaseModel):
    slot_time: time | None = None
    booking_date: date | None = None


# --- API Endpoints ---

@app.post("/makeappointements/drvijaydenyalhub")
def request_appointment(request: AppointmentRequest, session: Session = Depends(get_db)):
    # Save appointment request to the database for approval 
    try:
        # Parse the string into a full datetime object first
        parsed_datetime = datetime.strptime(request.slot_time, "%Y-%m-%dT%H:%M:%S%z")
        booking_date = parsed_datetime.date()
        slot_time_obj = parsed_datetime.time()
    except ValueError:
        raise HTTPException(status_code=400, detail="slot_time must be in ISO 8601 format, e.g. 2026-03-12T14:30:00Z")
    
    new_appointment = db.Appointment(
        client_name=request.client_name,
        client_email=request.client_email,
        client_mobile_no=request.mobile_no,
        booking_date=booking_date,
        user_timezone=request.user_timezone,           
        slot_time=slot_time_obj)            # Initially None, can be updated by doctor later
    
    session.add(new_appointment)
    session.commit()
    return {"message": "Request is submitted. Waiting for doctor's approval."}


@app.get("/doctor/pendingappointments")
def get_pending_appointments(session: Session = Depends(get_db)):
    # Doctor can see all pending appointment requests
    pending_appointments = session.query(db.Appointment).filter(db.Appointment.is_approved == False).all()
    return pending_appointments


@app.patch("/doctor/updateappointment/{appointment_id}")
async def update_appointment(appointment_id: int, update_data: AppointmentUpdate, session: Session = Depends(get_db)):
    db_appointment = session.query(db.Appointment).filter(db.Appointment.id == appointment_id).first()
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found.")
        
    if update_data.slot_time is not None:
        db_appointment.slot_time = update_data.slot_time
    if update_data.booking_date is not None:
        db_appointment.booking_date = update_data.booking_date
        
    session.add(db_appointment)
    session.commit()
    session.refresh(db_appointment)
    
    # Safely return a dictionary so FastAPI doesn't crash on SQLAlchemy objects
    return {
        "message": "Appointment updated and marked as pending approval.", 
        "appointment": {
            "id": db_appointment.id,
            "client_name": db_appointment.client_name,
            "booking_date": db_appointment.booking_date,
            "slot_time": db_appointment.slot_time,
            "is_approved": db_appointment.is_approved
        }
    }


@app.post("/doctor/approve/{appointment_id}")
async def approve_appointment(appointment_id: int, session: Session = Depends(get_db)):
    # 1. Fetch from DB
    apt = session.query(db.Appointment).filter(db.Appointment.id == appointment_id).first()
    
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    
    if apt.is_approved:
        return {"message": "Appointment already approved."}

    # 2. Prepare the message
    msg = f"Hi {apt.client_name}, your dental appointment has been confirmed by Dr. Vijay."

    try:
        # 3. Call our helper with data from the DB record
        calendar_link, event_id = add_to_calendar(
            name=apt.client_name,
            email=apt.client_email,
            booking_date=apt.booking_date,
            slot_time=apt.slot_time,
            custom_message=msg,
            user_timezone=apt.user_timezone
        )

        # 4. Update status in DB only if Calendar succeeds
        apt.is_approved = True
        
        # Save the calendar event ID to the database so we can delete it later
        if hasattr(apt, 'calendar_event_id'):
            apt.calendar_event_id = event_id
            
        session.commit()

        return {
            "status": "Approved",
            "client": apt.client_name,
            "google_calendar_link": calendar_link
        }

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")


@app.get("/doctor/approved")
async def get_approved_appointments(session: Session = Depends(get_db)):
    # Doctor can see all approved appointments
    approved_appointments = session.query(db.Appointment).filter(db.Appointment.is_approved == True).all()  
    return approved_appointments


# Unified Delete Route for both Pending and Approved
@app.delete("/doctor/delete/{appointment_id}")
async def delete_appointment(appointment_id: int, session: Session = Depends(get_db)):
    apt = session.query(db.Appointment).filter(db.Appointment.id == appointment_id).first()
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    
    # Check if it was approved and has a calendar ID. If so, delete from Google Calendar.
    if apt.is_approved and getattr(apt, 'calendar_event_id', None):
        delete_from_calendar_api(apt.calendar_event_id)

    # Now delete from our database
    session.delete(apt)
    session.commit()
    
    return {"message": f"Appointment is deleted successfully for {apt.client_name}"}