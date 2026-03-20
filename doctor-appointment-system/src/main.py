import os
import zoneinfo
from datetime import datetime, timedelta, date, time

from scheduler import schedule_reminder, scheduler
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session                                        
from dotenv import load_dotenv
from fastapi.security import OAuth2PasswordRequestForm
from googleapiclient.discovery import build 
from google.oauth2.credentials import Credentials
import config

import requests

import auth
import database as db
from database import get_db


load_dotenv()

app = FastAPI(title="Doctor Appointment System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,  
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def send_whatsapp_confirmation(phone_number: str, doctor_name: str, client_name: str, date: str, time: str):
    url = config.AISENSY_API_URL
    payload={
        "apikey": config.AISENSY_API_KEY_WP,
        "campaignName": "appotment_approvement",
        "destination": phone_number,
        "userName": client_name,
        "templateParams": [client_name, doctor_name, date, time],
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
        requests.post(url, json=payload, headers=headers)
    except Exception as e:
        print(f"whatsapp notification confirmation failed: {e}")



# def send_whatsapp_cancellation(phone_number: str, doctor_name: str, client_name: str, date: str, time: str):


def add_to_calendar(name, email, doctor_email, booking_date, slot_time, custom_message, user_timezone="UTC"):
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
        'attendees': [{'email': email},
                      {'email': doctor_email}]
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
class DoctorCreate(BaseModel):
    full_name: str 
    username: str
    email: EmailStr
    whatsapp_no: str
    password: str
    confirm_password: str
    
class AppointmentRequest(BaseModel):
    client_name: str
    client_email: EmailStr
    mobile_no: str 
    slot_time: str
    user_timezone: str = "UTC"  

class AppointmentUpdate(BaseModel):
    slot_time: time | None = None
    booking_date: date | None = None

class passwordResetRequest(BaseModel):
    identifier: str
    otp: str
    password: str

# --- API Endpoints ---
@app.post("/doctor/register")
def register_doctor(doctor: DoctorCreate, session: Session = Depends(get_db)):
    # Check if the doctor already exists
    db_doctor = session.query(db.Doctor).filter(db.Doctor.username == doctor.username).first()
    if db_doctor:
        raise HTTPException(status_code=400, detail="Doctor with this username already exists.")

    # Hash the password
    hashed_password = auth.get_password_hash(doctor.password)

    # Create a new doctor
    new_doctor = db.Doctor(username=doctor.username, hashed_password=hashed_password)
    session.add(new_doctor)
    session.commit()
    session.refresh(new_doctor)
    # return {"message": "Doctor registered successfully."}

    booking_link = f"{config.FRONTEND_BOOKING_BASE_URL}/{new_doctor.username}"
    return {"message": "Doctor registered!", "booking_link": booking_link}

@app.post("/doctor/login")
def login_doctor(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_db)):
    # Check if the doctor exists
    db_doctor = session.query(db.Doctor).filter(
        (db.Doctor.username == form_data.username) |
        (db.Doctor.email == form_data.username) |
        (db.Doctor.whatsapp_no == form_data.username)
    ).first()
    if not db_doctor or not auth.verify_password(form_data.password, db_doctor.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    # Create an access token
    access_token = auth.create_access_token(data={"sub": db_doctor.username})
    return {"message":"Successfully logged in","access_token": access_token, "token_type": "bearer"}

@app.post("/doctor/forgot-password")
def forgot_password(request: passwordResetRequest, session: Session = Depends(get_db)):
    otp_stored = auth.otp_storage.get(request.identifier)
    if not otp_stored or otp_stored != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP or number or email.")
    
    db_doctor = session.query(db.Doctor).filter(
        (db.Doctor.whatsapp_no == request.identifier) |
        (db.Doctor.email == request.identifier)
    ).first()

    if not db_doctor:
        raise HTTPException(status_code=404, detail="No account found with the provided number or email")
    
    db_doctor.hashed_password = auth.get_password_hash(request.password)
    session.commit()

    if request.identifier in auth.otp_storage:
        # gotta delete the OTP after successful reset to prevent reuse
        del auth.otp_storage[request.identifier]
    return {"message": "Password reset successful."}


@app.post("/book/{doctor_username}")
def request_appointment(doctor_username: str, request: AppointmentRequest, session: Session = Depends(get_db)):
    # Save appointment request to the database for approval 
    doctor = session.query(db.Doctor).filter(db.Doctor.username == doctor_username).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    if not request.slot_time:
        raise HTTPException(status_code=400, detail="slot_time is required.")
    try:
        # Parse the string into a full datetime object first
        parsed_datetime = datetime.strptime(request.slot_time, "%Y-%m-%dT%H:%M:%S%z")
        booking_date = parsed_datetime.date()
        slot_time_obj = parsed_datetime.time()
    except ValueError:
        raise HTTPException(status_code=400, detail="slot_time must be in ISO 8601 format, e.g. 2026-03-12T14:30:00Z")
    
    new_appointment = db.Appointment(
        doctor_id=doctor.id,
        client_name=request.client_name,
        client_email=request.client_email,
        whatsapp_no=request.mobile_no,
        booking_date=booking_date,
        user_timezone=request.user_timezone,           
        slot_time=slot_time_obj)            # Initially None, can be updated by doctor later
    
    session.add(new_appointment)
    session.commit()
    return {"message": "Request is submitted. Waiting for doctor's approval."}


@app.get("/doctor/pendingappointments")
def get_pending_appointments(current_doctor: db.Doctor = Depends(auth.get_current_doctor), session: Session = Depends(get_db)):
    # Doctor can see all pending appointment requests
    pending_appointments = session.query(db.Appointment).filter(db.Appointment.is_approved == False,db.Appointment.doctor_id == current_doctor.id).all()
    return pending_appointments


@app.patch("/doctor/updateappointment/{appointment_id}")
async def update_appointment(appointment_id: int, update_data: AppointmentUpdate, current_doctor: db.Doctor = Depends(auth.get_current_doctor), session: Session = Depends(get_db)):
    db_appointment = session.query(db.Appointment).filter(db.Appointment.id == appointment_id).first()
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if db_appointment.doctor_id != current_doctor.id:
        raise HTTPException(status_code=403, detail="You are not the owner of this appointment.")
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
async def approve_appointment(appointment_id: int, current_doctor: db.Doctor = Depends(auth.get_current_doctor), session: Session = Depends(get_db)):
    # 1. Fetch from DB
    apt = session.query(db.Appointment).filter(db.Appointment.id == appointment_id).first()
    
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if apt.doctor_id != current_doctor.id:
        raise HTTPException(status_code=403, detail="You are not the owner of this appointment.")
    
    if apt.is_approved:
        return {"message": "Appointment already approved."}
    display_name = getattr(current_doctor, 'full_name', current_doctor.username)
    # 2. Prepare the message
    date_str = apt.booking_date.strftime("%d %b %Y")
    time_str = apt.slot_time.strftime("%I:%M %p")
    msg = f"Hi {apt.client_name}, your dental appointment has been confirmed by {current_doctor.username}."

    try:
        # 3. Call our helper with data from the DB record
        calendar_link, event_id = add_to_calendar(
            name=apt.client_name,
            email=apt.client_email,
            doctor_email=current_doctor.email,
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
            apt.calendar_link = calendar_link 

        session.commit()

        schedule_reminder(apt, display_name)
                
        send_whatsapp_confirmation(
            phone_number=apt.whatsapp_no,
            client_name=apt.client_name,
            doctor_name=display_name,
            date=date_str,
            time=time_str
        )
        return {
            "status": "Approved",
            "client": apt.client_name,
            "google_calendar_link": calendar_link
        }

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")


@app.get("/doctor/approved")
async def get_approved_appointments(current_doctor: db.Doctor = Depends(auth.get_current_doctor), session: Session = Depends(get_db)):
    # Doctor can see all approved appointments
    approved_appointments = session.query(db.Appointment).filter(db.Appointment.is_approved == True, db.Appointment.doctor_id == current_doctor.id).all()
    return approved_appointments

@app.post("/sendotp")
async def send_otp(phone_number: str):
    import random
    otp = str(random.randint(100000, 999999))
    url = config.AISENSY_API_URL
    payload = {
        "apiKey": config.AISENSY_API_KEY_OTP,
        "campaignName": "medical-otp-registration",
        "destination": phone_number,  
        "userName": "User",
        "templateParams": [otp],
        "source": "new-landing-page form",
        "media": {},
        "buttons": [
            {
                "type": "button",
                "sub_type": "url",
                "index": 0,
                "parameters": [{"type": "text", "text": otp}]
            }
        ],                                                                                                                                                                                
        "carouselCards": [],
        "location": {},
        "attributes": {},
        "paramsFallbackValue": {"FirstName": "user"}
    }
    headers = {"Content-Type": "application/json"}
    try:
        # auth.store_otp = otp
        response = requests.post(url, json = payload, headers = headers)
        response_data = response.json()
        if response.status_code == 200:
            auth.otp_storage[phone_number] = otp
            return {"message":"OTP sent successfully","status":"successfully sent"}
        else:
            raise HTTPException(status_code = response.status_code, detail = response_data.get("message", "Failed to send OTP"))
    except Exception as e:
        raise HTTPException(status_code = 500, detail = f"Error sending OTP: {str(e)}")

@app.get("/verify_otp")
async def verify_otp(phone_number: str, otp: str):
    stored_otp = auth.otp_storage.get(phone_number)

    if otp == stored_otp:
        return {"message": "OTP is verified successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid OTP")

# Unified Delete Route for both Pending and Approved
@app.delete("/doctor/delete/{appointment_id}")
async def delete_appointment(appointment_id: int, 
                             current_doctor: db.Doctor = Depends(auth.get_current_doctor), 
                             session: Session = Depends(get_db)):
    
    apt = session.query(db.Appointment).filter(db.Appointment.id == appointment_id).first()

    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if apt.doctor_id != current_doctor.id:
        raise HTTPException(status_code=403, detail="You are not the owner of this appointment.")

    # Check if it was approved and has a calendar ID. If so, delete from Google Calendar.
    if apt.is_approved and getattr(apt, 'calendar_event_id', None):
        delete_from_calendar_api(apt.calendar_event_id)

    try:
        # Check if the job exists and remove it
        if scheduler.get_job(f"reminder_{apt.id}"):
            scheduler.remove_job(f"reminder_{apt.id}")
    except Exception as e:
        print(f"Failed to remove scheduled job: {e}")

    # Now delete from our database
    session.delete(apt)
    session.commit()
    
    return {"message": f"Appointment is deleted successfully for {apt.client_name}"}


    