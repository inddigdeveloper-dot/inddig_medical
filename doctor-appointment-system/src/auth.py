import os 
from datetime import datetime, timedelta, UTC
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Import your database and models
import database as db
# Note: You will need to import your get_db function here. 
# If it is in main.py, you might get a circular import, so it's 
# best to move the get_db function into database.py!
from database import get_db 

load_dotenv()

# --- JWT Authentication Setup --- 

SECRET_KEY = os.getenv("SECRET_KEY", "KABSDFJIKBSFKJ")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="doctor/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    # Using timezone-aware UTC (datetime.utcnow is deprecated in modern Python)
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # algorithm takes a string here, not a list
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_doctor(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_db)  # Inject the database session
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )
    
    try:
        # algorithms takes a list here
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        
        if username is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception

    # Use lowercase .query()
    doctor = session.query(db.Doctor).filter(db.Doctor.username == username).first()
    
    if doctor is None:
        raise credentials_exception
        
    return doctor
    # import os 
# from jose import JWTError, jwt
# from passlib.context import CryptContext
# from datetime import datetime, timedelta
# from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
# from fastapi import Depends, HTTPException, status
# from sqlalchemy.orm import Session
# from dotenv import load_dotenv
# import database as db
# from database import get_db

# # JWT authentication 

# SECRET_KEY = os.getenv("SECRET_KEY", "KABSDFJIKBSFKJ")
# ALGORITHM = "HS256"
# ACCESS_TOKEN_EXPIRE_MINUTES = 30

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="doctor/login")

# def verify_password(plain_password, hashed_password):
#     return pwd_context.verify(plain_password, hashed_password)

# def get_password_hash(password):
#     return pwd_context.hash(password)

# def create_access_token(data: dict):
#     to_encode = data.copy()
#     expire = datetime.now(UTC) + timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)
#     to_encode.update({"exp": expire})
#     return jwt.encode(to_encode, SECRET_KEY, algorithm = ALGORITHM)

# def get_current_doctor(token: str = Depends(oauth2_scheme),session: Session = Depends(get_db)):
#     credentials_exception = HTTPException(
#         status_code=status.HTTP_401_UNAUTHORIZED,
#         detail="could not validate credentials",
#         headers={"WWW-Authenticate": "Bearer"}
#     )
#     try:
#         payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
#         username: str = payload.get("sub")
        
#         if username is None:
#             raise credential_exception
        
#     except JWTError:
#         raise credentials_exception


#     doctor = session.Query(db.Doctor).filter(db.Doctor.username == username).first()

#     if doctor is None:
#         raise credentials_exception
    
#     return doctor    
    