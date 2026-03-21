import os
from sqlalchemy import create_engine, text
import database as db # Import your database.py

# 1. Get the URL
url = os.getenv("DATABASE_URL")
if url and url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql://", 1)

engine = create_engine(url)

def migrate():
    print("🚀 Starting migration check...")
    with engine.connect() as conn:
        # List of columns to check/add
        columns_to_add = [
            ("full_name", "VARCHAR"),
            ("email", "VARCHAR"),
            ("whatsapp_no", "VARCHAR"),
            ("calendar_link", "VARCHAR"),
            ("is_verified", "BOOLEAN DEFAULT FALSE")
        ]
        
        for col_name, col_type in columns_to_add:
            try:
                # This safely adds the column only if it's missing
                conn.execute(text(f"ALTER TABLE doctors ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
                conn.commit()
                print(f"✅ Column '{col_name}' checked/added.")
            except Exception as e:
                print(f"❌ Error adding {col_name}: {e}")
    
    print("✨ Migration finished. Your database matches your code!")

if __name__ == "__main__":
    migrate()