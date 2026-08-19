"""
PhishVision Database Layer — SQLAlchemy ORM with SQLite
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "phishvision.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ScanResult(Base):
    __tablename__ = "scan_results"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255), index=True, nullable=False)
    url = Column(String(2048), nullable=False)
    target_brand = Column(String(255), nullable=True)
    client_id = Column(String(128), nullable=True, index=True)  # anonymous browser fingerprint

    # Scores (0.0 – 1.0)
    overall_score = Column(Float, default=0.0)
    url_score = Column(Float, default=0.0)
    whois_score = Column(Float, default=0.0)
    content_score = Column(Float, default=0.0)
    visual_score = Column(Float, default=0.0)
    dns_score = Column(Float, default=0.0)

    verdict = Column(String(50), default="unknown")   # phishing / suspicious / safe / unknown
    confidence = Column(String(50), default="low")    # high / medium / low

    # Detail blobs
    url_features = Column(JSON, nullable=True)
    whois_data = Column(JSON, nullable=True)
    dns_data = Column(JSON, nullable=True)
    content_features = Column(JSON, nullable=True)
    visual_features = Column(JSON, nullable=True)
    ml_features = Column(JSON, nullable=True)

    # Meta
    screenshot_path = Column(String(512), nullable=True)
    scan_duration_ms = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    is_auto_scan = Column(Boolean, default=False)
    scanned_at = Column(DateTime, default=datetime.utcnow)


class TargetBrand(Base):
    __tablename__ = "target_brands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=False, unique=True)
    category = Column(String(100), nullable=True)
    logo_url = Column(String(512), nullable=True)
    login_url = Column(String(512), nullable=True)
    keywords = Column(JSON, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(64), unique=True, index=True)
    status = Column(String(50), default="pending")   # pending / running / completed / failed
    total_domains = Column(Integer, default=0)
    scanned_domains = Column(Integer, default=0)
    phishing_found = Column(Integer, default=0)
    source = Column(String(100), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)


class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id = Column(Integer, primary_key=True, index=True)
    threshold = Column(Float, default=0.7)
    email_enabled = Column(Boolean, default=False)
    email_address = Column(String(255), nullable=True)
    webhook_url = Column(String(512), nullable=True)
    auto_scan_enabled = Column(Boolean, default=True)
    auto_scan_interval_hours = Column(Integer, default=6)
    updated_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
