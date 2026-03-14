from sqlalchemy import create_engine,Integer, Date, Time, Column, String, Boolean, DateTime, BOOLEAN
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, UTC

# now = datetime.now(UTC)
SQLALCHEMY_DATABASE_URL = "sqlite:///./appointments.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autoflush=False, 
                            autocommit = False, 
                            bind = engine )

Base = declarative_base()

class Appointment(Base):
    __tablename__="appointments"
    id = Column(Integer, primary_key = True, index=True)

    client_name = Column(String)
    client_email = Column(String, unique=False, index=True)
    client_mobile_no = Column(String)

    user_timezone = Column(String, default="UTC")
    # patient's booked time 
    booking_date = Column(Date)
    slot_time = Column(Time)
    #it means it can be nullable because doctor also cant change and directly approves the apppointment
    # approval status of the appointment
    is_approved = Column(Boolean, default = False)
    calendar_event_id = Column(String, nullable=True)
    
Base.metadata.create_all(bind=engine)