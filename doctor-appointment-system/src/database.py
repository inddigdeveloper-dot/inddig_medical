import os
from sqlalchemy import ForeignKey, create_engine,Integer, Date, Time, Column, String, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker,relationship,Session
from datetime import datetime, UTC

# now = datetime.now(UTC)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL","sqlite:///./appointments.db")

if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)


if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autoflush=False, 
                            autocommit = False, 
                            bind = engine )

Base = declarative_base()
class Doctor(Base):
    __tablename__="doctors"    
    id = Column(Integer,primary_key=True, index=True)
    full_name = Column(String, nullable=True) 
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=False, index=True)
    
    google_refresh_token = Column(String, nullable=True)
    google_calendar_id = Column(String, default="primary")
    
    whatsapp_no = Column(String, unique=False, index=True)
    hashed_password = Column(String)
    calendar_link = Column(String, nullable=True) 
    is_verified = Column(Boolean, default = False)
    appointments = relationship("Appointment", back_populates="doctor")

class Appointment(Base):
    __tablename__="appointments"
    id = Column(Integer, primary_key = True, index=True)

    doctor_id = Column(Integer, ForeignKey("doctors.id"))
    doctor = relationship("Doctor", back_populates="appointments")

    client_name = Column(String)
    client_email = Column(String, unique=True, index=True)
    whatsapp_no = Column(String, unique=True, index=True)

    user_timezone = Column(String, default="UTC")
    # patient's booked time 
    booking_date = Column(Date)
    slot_time = Column(Time)
    #it means it can be nullable because doctor also cant change and directly approves the apppointment
    # approval status of the appointment
    is_approved = Column(Boolean, default = False)
    calendar_event_id = Column(String, nullable=True)
    google_calendar_link = Column(String, nullable=True) # The HTML Link for the button
    
Base.metadata.create_all(bind=engine)
def get_db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()