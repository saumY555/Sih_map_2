"""
Database connection and session management for CMPDIPS.
Supports PostgreSQL (with PostGIS) or SQLite (fallback for local dev).
"""

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Auto-detect: use PostgreSQL if configured, else fall back to SQLite
if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
    engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
    DB_TYPE = "postgresql"
else:
    SQLITE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cmpdips.db")
    DATABASE_URL = f"sqlite:///{SQLITE_PATH}"
    engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
    DB_TYPE = "sqlite"

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and auto-closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
