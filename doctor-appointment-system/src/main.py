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

app = FastAPI(title="Doctor Appointment System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,  
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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
    print("\n--- 🛠️ STARTING WHATSAPP CONFIRMATION DEBUG 🛠️ ---")
    
    url = config.AISENSY_API_URL 
    api_key = config.AISENSY_API_KEY_WP
    
    # DEBUG 1: Check if environment variables are actually loaded
    if not url:
        print("🚨 CRITICAL ERROR: config.AISENSY_API_URL is missing! Check your Railway Variables or .env file.")
        return # Stop execution so we don't crash
        
    if not api_key:
        print("🚨 CRITICAL ERROR: config.AISENSY_API_KEY_WP is missing! Check your Railway Variables or .env file.")
        return

    # DEBUG 2: Check phone number formatting
    destination_phone = phone_number.replace("+", "").replace(" ", "").strip()
    if len(destination_phone) == 10:
        destination_phone = f"91{destination_phone}"
        
    print(f"👉 Target URL: {url}")
    print(f"👉 Formatted Phone: {destination_phone}")
    print(f"👉 Using API Key: {api_key[:10]}... (truncated for security)")

    # The payload
    payload = {
        "apiKey": api_key, 
        "campaignName": "appotment_approvement", # Must match AiSensy EXACTLY
        "destination": destination_phone,
        "userName": client_name,
        "templateParams": [
            str(client_name),
            str(doctor_name),
            str(date),       
            str(time)        
        ],
        "source": "new-landing-page form",
        "media": {},
        "buttons": [],
        "carouselCards": [],
        "location": {},
        "attributes": {},
        "paramsFallbackValue": {"FirstName": "user"}
    }

    headers = {"Content-Type": "application/json"}
    
    try:
        print("👉 Sending payload to AiSensy...")
        # Added a 10-second timeout so it doesn't hang forever
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        # DEBUG 3: Catch API rejections specifically
        if response.status_code != 200:
             print(f"🚨 AiSensy API REJECTED the request!")
             print(f"🚨 Status Code: {response.status_code}")
             print(f"🚨 Exact Error Reason: {response.text}") 
        else:
             print(f"✅ WhatsApp Success Response: {response.json()}")
             
    # Catch internet/network issues
    except requests.exceptions.RequestException as req_err:
        print(f"🚨 Network Error (Could not reach AiSensy): {req_err}")
    # Catch python coding errors
    except Exception as e:
        print(f"🚨 General Python Error in WhatsApp function: {e}")
        
    print("--- 🛠️ END WHATSAPP CONFIRMATION DEBUG 🛠️ ---\n")


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

    attendees_list = []
    if email:
        attendees_list.append({'email': email})
    if doctor_email:
        attendees_list.append({'email': doctor_email})
    # 3. Format the event body
    time_str = local_start.strftime('%I:%M %p')
    event = {
        'summary': f'Dental Appointment: {name}',
        'description': f'{custom_message}\n\nNote: This is {time_str} in your time ({user_timezone})',
        'start': {'dateTime': local_start.isoformat(), 'timeZone': user_timezone},
        'end': {'dateTime': local_end.isoformat(), 'timeZone': user_timezone},
        'attendees': attendees_list,
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
    print("\n--- 🛠️ REGISTRATION DATA FLOW DEBUG 🛠️ ---")
    print(f"📥 Incoming JSON -> Name: {doctor.full_name}, User: {doctor.username}, WP: {doctor.whatsapp_no}, Email: {doctor.email}")

    # Check if username exists
    existing_user = session.query(db.Doctor).filter(db.Doctor.username == doctor.username).first()
    if existing_user:
        print(f"❌ Aborting: Username '{doctor.username}' already in DB.")
        raise HTTPException(status_code=400, detail="Username already exists.")

    # Hash the password
    hashed_password = auth.get_password_hash(doctor.password)

    # CREATE THE OBJECT WITH ALL FIELDS
    new_doctor = db.Doctor(
        full_name=doctor.full_name,        # NOW BEING SAVED
        username=doctor.username,
        email=doctor.email,                # NOW BEING SAVED
        whatsapp_no=doctor.whatsapp_no,    # NOW BEING SAVED
        hashed_password=hashed_password
    )

    try:
        session.add(new_doctor)
        session.commit()
        session.refresh(new_doctor)
        
        print("✅ DATABASE RECORD CREATED SUCCESSFULLY")
        print(f"🆔 New Doctor ID: {new_doctor.id}")
        print(f"📱 Saved WhatsApp in DB: {new_doctor.whatsapp_no}")
        
    except Exception as e:
        session.rollback()
        print(f"🚨 DB COMMIT FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error during registration.")

    booking_link = f"{config.FRONTEND_BOOKING_BASE_URL}/{new_doctor.username}"
    print(f"🔗 Booking Link: {booking_link}")
    print("--- 🛠️ END REGISTRATION DEBUG 🛠️ ---\n")
    
    return {"message": "Doctor registered!", "booking_link": booking_link}

@app.post("/doctor/login")
def login_doctor(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_db)):
    print(f"\n--- 🔐 DOCTOR LOGIN ATTEMPT 🔐 ---")
    print(f"👉 Identifier Provided: {form_data.username}")

    # 1. Search the DB for any of the three fields
    db_doctor = session.query(db.Doctor).filter(
        (db.Doctor.username == form_data.username) |
        (db.Doctor.email == form_data.username) |
        (db.Doctor.whatsapp_no == form_data.username)
    ).first()

    # 2. Check if Doctor exists
    if not db_doctor:
        print(f"❌ LOGIN FAILED: No account found for '{form_data.username}'")
        raise HTTPException(status_code=400, detail="Incorrect username, email, or WhatsApp number.")

    # 3. Verify Password
    if not auth.verify_password(form_data.password, db_doctor.hashed_password):
        print(f"❌ LOGIN FAILED: Incorrect password for {db_doctor.username}")
        raise HTTPException(status_code=400, detail="Incorrect password.")

    # 4. Success Log
    print(f"✅ LOGIN SUCCESS: Authenticated as {db_doctor.username} (ID: {db_doctor.id})")
    
    # Create an access token
    access_token = auth.create_access_token(data={"sub": db_doctor.username})
    
    print("--- 🔐 LOGIN DEBUG COMPLETE 🔐 ---\n")
    return {
        "message": "Successfully logged in",
        "access_token": access_token, 
        "token_type": "bearer",
        "username": db_doctor.username # Useful for frontend to store
    }

@app.post("/doctor/forgot-password")
def forgot_password(request: passwordResetRequest, session: Session = Depends(get_db)):
    print(f"\n--- 🛠️ STARTING PASSWORD RESET DEBUG for {request.identifier} 🛠️ ---")
    
    # 1. Check OTP Storage
    otp_stored = auth.otp_storage.get(request.identifier)
    print(f"👉 Stored OTP: {otp_stored} | User Provided OTP: {request.otp}")
    
    if not otp_stored or otp_stored != request.otp:
        print("🚨 CRITICAL ERROR: OTP mismatch or OTP expired/not found in storage.")
        print("--- 🛠️ END PASSWORD RESET DEBUG 🛠️ ---\n")
        raise HTTPException(status_code=400, detail="Invalid OTP or number or email.")
    
    print("✅ OTP matched successfully.")

    # 2. Query the Database
    print(f"👉 Searching database for Doctor with email or whatsapp_no: {request.identifier}")
    db_doctor = session.query(db.Doctor).filter(
        (db.Doctor.whatsapp_no == request.identifier) |
        (db.Doctor.email == request.identifier)
    ).first()

    if not db_doctor:
        print(f"🚨 CRITICAL ERROR: OTP was correct, but no Doctor exists in the DB with identifier {request.identifier}")
        print("--- 🛠️ END PASSWORD RESET DEBUG 🛠️ ---\n")
        raise HTTPException(status_code=404, detail="No account found with the provided number or email")
    
    print(f"✅ Doctor found in DB: {db_doctor.username}. Proceeding to update password.")

    # 3. Update Password
    try:
        db_doctor.hashed_password = auth.get_password_hash(request.password)
        session.commit()
        print("✅ Password successfully hashed and saved to database.")
    except Exception as e:
        session.rollback()
        print(f"🚨 DATABASE ERROR: Failed to save new password: {e}")
        print("--- 🛠️ END PASSWORD RESET DEBUG 🛠️ ---\n")
        raise HTTPException(status_code=500, detail="Internal database error while resetting password.")

    # 4. Cleanup
    if request.identifier in auth.otp_storage:
        del auth.otp_storage[request.identifier]
        print(f"✅ OTP for {request.identifier} deleted from temporary storage to prevent reuse.")
        
    print("--- 🛠️ END PASSWORD RESET DEBUG (SUCCESS) 🛠️ ---\n")
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
        # We removed the %z at the end so it accepts the simple ISO string
        parsed_datetime = datetime.strptime(request.slot_time, "%Y-%m-%dT%H:%M:%S")
        booking_date = parsed_datetime.date()
        slot_time_obj = parsed_datetime.time()
    except ValueError:
        raise HTTPException(status_code=400, detail="slot_time must be in format YYYY-MM-DDTHH:MM:SS")
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
    # 1. Fetch from DB - DO THIS OUTSIDE TRY
    apt = session.query(db.Appointment).filter(db.Appointment.id == appointment_id).first()
    
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if apt.doctor_id != current_doctor.id:
        raise HTTPException(status_code=403, detail="You are not the owner of this appointment.")
    
    if apt.is_approved:
        return {"message": "Appointment already approved."}

    # 2. Prepare Data - DO THIS OUTSIDE TRY
    display_name = getattr(current_doctor, 'full_name', current_doctor.username)
    date_str = apt.booking_date.strftime("%d %b %Y")
    time_str = apt.slot_time.strftime("%I:%M %p")
    msg = f"Hi {apt.client_name}, your dental appointment has been confirmed by {current_doctor.full_name}."
    
    # Clean the phone number here
    phone = apt.whatsapp_no
    if phone and len(phone) == 10:
        phone = f"91{phone}"

    try:
        # 3. External API Calls returns the link and ID
        calendar_link, event_id = add_to_calendar(
            name=apt.client_name,
            email=apt.client_email,
            doctor_email=current_doctor.email,
            booking_date=apt.booking_date,
            slot_time=apt.slot_time,
            custom_message=msg,
            user_timezone=apt.user_timezone
        )

        # 4. Update DB - Corrected assignments
        apt.is_approved = True
        apt.calendar_event_id = event_id
        apt.google_calendar_link = calendar_link # This is the link for your button!

        session.commit()
        # 5. Background Tasks / Notifications
        # Use 'phone' (the cleaned version) and 'apt' safely here
        schedule_reminder(apt, display_name)
        
        send_whatsapp_confirmation(
            phone_number=phone, # Use the cleaned phone variable
            doctor_name=display_name,
            client_name=apt.client_name,
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
        # Log the actual error to Railway logs so you can see it
        print(f"DETAILED ERROR: {str(e)}") 
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



    