"""
PhishVision AI — FastAPI Backend
"""
import os
import json
import logging
import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List, Optional, Any

import colorlog
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl, validator
from sqlalchemy.orm import Session

from database import init_db, get_db, ScanResult, ScanJob, TargetBrand, AlertConfig
from scanner import scan_domain, scan_bulk, fetch_newly_registered_domains
from targets import DEFAULT_TARGETS
from reports import generate_json_report, generate_csv_report, generate_pdf_report

# ── Logging ──────────────────────────────────────────────────────────────────
handler = colorlog.StreamHandler()
handler.setFormatter(colorlog.ColoredFormatter(
    "%(log_color)s%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
))
logging.basicConfig(level=logging.INFO, handlers=[handler])
logger = logging.getLogger("phishvision")

# Suppress noisy libraries
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("playwright").setLevel(logging.WARNING)


# ── Startup / Shutdown ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PhishVision AI starting up...")
    init_db()
    _seed_default_targets()
    _start_scheduler()
    yield
    logger.info("PhishVision AI shutting down...")


def _seed_default_targets():
    """Seed default brand targets if table is empty."""
    db = next(get_db())
    try:
        count = db.query(TargetBrand).count()
        if count == 0:
            for t in DEFAULT_TARGETS:
                brand = TargetBrand(
                    name=t["name"],
                    domain=t["domain"],
                    category=t.get("category"),
                    login_url=t.get("login_url"),
                    keywords=t.get("keywords", []),
                )
                db.add(brand)
            db.commit()
            logger.info(f"Seeded {len(DEFAULT_TARGETS)} default target brands")
    except Exception as e:
        logger.error(f"Seed error: {e}")
    finally:
        db.close()


scheduler = None


def _start_scheduler():
    global scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            _auto_scan_job,
            'interval',
            hours=6,
            id='auto_scan',
            replace_existing=True,
        )
        scheduler.start()
        logger.info("Background scheduler started (auto-scan every 6 hours)")
    except Exception as e:
        logger.warning(f"Scheduler not started: {e}")


async def _auto_scan_job():
    logger.info("Auto-scan job triggered")
    db = next(get_db())
    try:
        domains = await fetch_newly_registered_domains(limit=50)
        if domains:
            await scan_bulk(domains, db, enable_screenshot=False, is_auto_scan=True)
            logger.info(f"Auto-scan completed: {len(domains)} domains")
    except Exception as e:
        logger.error(f"Auto-scan job failed: {e}")
    finally:
        db.close()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PhishVision AI",
    description="Automated AI-powered phishing domain detection platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve screenshots statically
screenshots_path = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(screenshots_path, exist_ok=True)
app.mount("/screenshots", StaticFiles(directory=screenshots_path), name="screenshots")


# ── Pydantic Schemas ──────────────────────────────────────────────────────────
class ScanRequest(BaseModel):
    url: str
    enable_screenshot: bool = True

    @validator("url")
    def validate_url(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("URL cannot be empty")
        return v


class BulkScanRequest(BaseModel):
    urls: List[str]
    enable_screenshot: bool = False

    @validator("urls")
    def validate_urls(cls, v):
        if not v:
            raise ValueError("URLs list cannot be empty")
        if len(v) > 500:
            raise ValueError("Maximum 500 URLs per bulk scan")
        return [u.strip() for u in v if u.strip()]


class TargetBrandCreate(BaseModel):
    name: str
    domain: str
    category: Optional[str] = None
    login_url: Optional[str] = None
    keywords: Optional[List[str]] = []


# ── Scan Endpoints ────────────────────────────────────────────────────────────
@app.post("/api/scan", tags=["Scanning"])
async def scan_single(
    request: ScanRequest,
    db: Session = Depends(get_db),
    x_client_id: Optional[str] = Header(None),
):
    """Scan a single domain/URL for phishing indicators."""
    try:
        result = await scan_domain(
            url=request.url,
            db=db,
            enable_screenshot=request.enable_screenshot,
            client_id=x_client_id,
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Scan API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/scan/bulk", tags=["Scanning"])
async def scan_bulk_endpoint(
    request: BulkScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Scan multiple domains. Returns immediately with job_id for polling."""
    job_id = str(uuid.uuid4())

    # Create job record
    job = ScanJob(
        job_id=job_id,
        status="pending",
        total_domains=len(request.urls),
        source="bulk_api",
    )
    db.add(job)
    db.commit()

    async def run_bulk():
        new_db = next(get_db())
        try:
            await scan_bulk(request.urls, new_db, enable_screenshot=request.enable_screenshot)
        finally:
            new_db.close()

    background_tasks.add_task(run_bulk)
    return {"success": True, "job_id": job_id, "total": len(request.urls)}


@app.get("/api/scan/job/{job_id}", tags=["Scanning"])
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Poll bulk scan job status."""
    job = db.query(ScanJob).filter(ScanJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.job_id,
        "status": job.status,
        "total_domains": job.total_domains,
        "scanned_domains": job.scanned_domains,
        "phishing_found": job.phishing_found,
        "progress_pct": round(job.scanned_domains / max(job.total_domains, 1) * 100, 1),
        "started_at": job.started_at,
        "completed_at": job.completed_at,
    }


@app.post("/api/scan/auto", tags=["Scanning"])
async def trigger_auto_scan(db: Session = Depends(get_db)):
    """Manually trigger an auto-scan of newly registered domains."""
    domains = await fetch_newly_registered_domains(limit=50)
    job_id = str(uuid.uuid4())
    result = await scan_bulk(domains, db, enable_screenshot=False, is_auto_scan=True)
    return {"success": True, "data": result}


# ── Results Endpoints ─────────────────────────────────────────────────────────
@app.get("/api/results", tags=["Results"])
def get_results(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    verdict: Optional[str] = None,
    target_brand: Optional[str] = None,
    min_score: Optional[float] = Query(None, ge=0, le=1),
    max_score: Optional[float] = Query(None, ge=0, le=1),
    since_hours: Optional[int] = Query(None, ge=1),
    search: Optional[str] = None,
    client_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get paginated scan results — filtered to the requesting browser's scans."""
    q = db.query(ScanResult)

    # Only show this browser's own scans when a client_id is provided
    if client_id:
        q = q.filter(ScanResult.client_id == client_id)

    if verdict:
        q = q.filter(ScanResult.verdict == verdict)
    if target_brand:
        q = q.filter(ScanResult.target_brand.ilike(f"%{target_brand}%"))
    if min_score is not None:
        q = q.filter(ScanResult.overall_score >= min_score)
    if max_score is not None:
        q = q.filter(ScanResult.overall_score <= max_score)
    if since_hours:
        cutoff = datetime.utcnow() - timedelta(hours=since_hours)
        q = q.filter(ScanResult.scanned_at >= cutoff)
    if search:
        q = q.filter(ScanResult.domain.ilike(f"%{search}%"))

    total = q.count()
    items = (
        q.order_by(ScanResult.scanned_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
        "items": [_serialize_result(r) for r in items],
    }


@app.get("/api/results/{result_id}/report", tags=["Export"])
def export_single_result(result_id: int, db: Session = Depends(get_db)):
    """Download a detailed PDF report for a single scan result."""
    r = db.query(ScanResult).filter(ScanResult.id == result_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Result not found")
    data = _serialize_result(r, include_screenshot=False)
    from reports import generate_single_pdf_report
    content = generate_single_pdf_report(data)
    safe_domain = r.domain.replace('.', '_').replace('/', '_')
    filename = f"phishvision_{safe_domain}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def get_result(result_id: int, db: Session = Depends(get_db)):
    """Get a single scan result by ID with full detail."""
    r = db.query(ScanResult).filter(ScanResult.id == result_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Result not found")
    return _serialize_result(r, include_screenshot=True)


@app.delete("/api/results/{result_id}", tags=["Results"])
def delete_result(result_id: int, db: Session = Depends(get_db)):
    """Delete a scan result."""
    r = db.query(ScanResult).filter(ScanResult.id == result_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Result not found")
    db.delete(r)
    db.commit()
    return {"success": True}


# ── Dashboard Stats ───────────────────────────────────────────────────────────
@app.get("/api/stats", tags=["Dashboard"])
def get_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics."""
    total = db.query(ScanResult).count()
    phishing = db.query(ScanResult).filter(ScanResult.verdict == "phishing").count()
    suspicious = db.query(ScanResult).filter(ScanResult.verdict == "suspicious").count()
    safe = db.query(ScanResult).filter(ScanResult.verdict == "safe").count()

    last_24h = db.query(ScanResult).filter(
        ScanResult.scanned_at >= datetime.utcnow() - timedelta(hours=24)
    ).count()

    last_7d = db.query(ScanResult).filter(
        ScanResult.scanned_at >= datetime.utcnow() - timedelta(days=7)
    ).count()

    # Top targeted brands
    from sqlalchemy import func
    brand_counts = (
        db.query(ScanResult.target_brand, func.count(ScanResult.id).label("count"))
        .filter(ScanResult.target_brand.isnot(None))
        .filter(ScanResult.verdict == "phishing")
        .group_by(ScanResult.target_brand)
        .order_by(func.count(ScanResult.id).desc())
        .limit(10)
        .all()
    )

    # Score distribution buckets
    buckets = {}
    for label, low, high in [
        ("0–20%", 0.0, 0.2), ("20–40%", 0.2, 0.4), ("40–60%", 0.4, 0.6),
        ("60–80%", 0.6, 0.8), ("80–100%", 0.8, 1.01),
    ]:
        count = db.query(ScanResult).filter(
            ScanResult.overall_score >= low,
            ScanResult.overall_score < high,
        ).count()
        buckets[label] = count

    return {
        "total_scanned": total,
        "phishing_count": phishing,
        "suspicious_count": suspicious,
        "safe_count": safe,
        "detection_rate": round(phishing / max(total, 1) * 100, 1),
        "last_24h": last_24h,
        "last_7d": last_7d,
        "top_targeted_brands": [{"brand": b, "count": c} for b, c in brand_counts],
        "score_distribution": buckets,
    }


@app.get("/api/stats/timeline", tags=["Dashboard"])
def get_timeline(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    """Get scan timeline for charts."""
    from sqlalchemy import func, text
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    # Use SQLite's strftime for date grouping — works with ISO string storage
    rows = (
        db.query(
            func.strftime('%Y-%m-%d', ScanResult.scanned_at).label("date"),
            func.count(ScanResult.id).label("total"),
        )
        .filter(ScanResult.scanned_at >= cutoff)
        .group_by(func.strftime('%Y-%m-%d', ScanResult.scanned_at))
        .order_by(func.strftime('%Y-%m-%d', ScanResult.scanned_at))
        .all()
    )
    return [{"date": r.date, "total": r.total} for r in rows]


# ── Target Brands ─────────────────────────────────────────────────────────────
@app.get("/api/targets", tags=["Targets"])
def get_targets(db: Session = Depends(get_db)):
    brands = db.query(TargetBrand).all()
    return [_serialize_brand(b) for b in brands]


@app.post("/api/targets", tags=["Targets"])
def create_target(body: TargetBrandCreate, db: Session = Depends(get_db)):
    existing = db.query(TargetBrand).filter(TargetBrand.domain == body.domain).first()
    if existing:
        raise HTTPException(status_code=409, detail="Target brand with this domain already exists")
    brand = TargetBrand(**body.dict())
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return _serialize_brand(brand)


@app.delete("/api/targets/{brand_id}", tags=["Targets"])
def delete_target(brand_id: int, db: Session = Depends(get_db)):
    brand = db.query(TargetBrand).filter(TargetBrand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    db.delete(brand)
    db.commit()
    return {"success": True}


# ── Export ───────────────────────────────────────────────────────────────────
@app.get("/api/export", tags=["Export"])
def export_results(
    format: str = Query("json", regex="^(json|csv|pdf)$"),
    verdict: Optional[str] = None,
    since_hours: Optional[int] = None,
    client_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Export scan results in JSON, CSV, or PDF format."""
    q = db.query(ScanResult)
    if client_id:
        q = q.filter(ScanResult.client_id == client_id)
    if verdict:
        q = q.filter(ScanResult.verdict == verdict)
    if since_hours:
        cutoff = datetime.utcnow() - timedelta(hours=since_hours)
        q = q.filter(ScanResult.scanned_at >= cutoff)
    results = q.order_by(ScanResult.scanned_at.desc()).limit(5000).all()
    data = [_serialize_result(r) for r in results]

    if format == "json":
        content = generate_json_report(data)
        return Response(content=content, media_type="application/json",
                        headers={"Content-Disposition": "attachment; filename=phishvision_report.json"})
    elif format == "csv":
        content = generate_csv_report(data)
        return Response(content=content, media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=phishvision_report.csv"})
    elif format == "pdf":
        content = generate_pdf_report(data)
        return Response(content=content, media_type="application/pdf",
                        headers={"Content-Disposition": "attachment; filename=phishvision_report.pdf"})


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
def health_check():
    return {"status": "ok", "version": "1.0.0", "timestamp": datetime.utcnow().isoformat()}


# ── Serializers ───────────────────────────────────────────────────────────────
def _serialize_result(r: ScanResult, include_screenshot: bool = False) -> dict:
    d = {
        "id": r.id,
        "domain": r.domain,
        "url": r.url,
        "target_brand": r.target_brand,
        "overall_score": r.overall_score,
        "url_score": r.url_score,
        "whois_score": r.whois_score,
        "content_score": r.content_score,
        "visual_score": r.visual_score,
        "dns_score": r.dns_score,
        "verdict": r.verdict,
        "confidence": r.confidence,
        "url_features": r.url_features,
        "whois_data": r.whois_data,
        "dns_data": r.dns_data,
        "content_features": r.content_features,
        "visual_features": r.visual_features,
        "scan_duration_ms": r.scan_duration_ms,
        "error_message": r.error_message,
        "is_auto_scan": r.is_auto_scan,
        "scanned_at": r.scanned_at.isoformat() if r.scanned_at else None,
    }
    if include_screenshot and r.screenshot_path:
        from visual import screenshot_to_base64
        d["screenshot_b64"] = screenshot_to_base64(r.screenshot_path)
    return d


def _serialize_brand(b: TargetBrand) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "domain": b.domain,
        "category": b.category,
        "login_url": b.login_url,
        "keywords": b.keywords,
        "active": b.active,
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
