"""
PhishVision Scanner — Core scan orchestration + background job scheduler
"""
import uuid
import time
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session

from database import ScanResult, ScanJob, TargetBrand, SessionLocal
from ml_model import extract_url_features, compute_url_phishing_score
from whois_intel import safe_whois, get_dns_records, compute_whois_score
from content import fetch_page, extract_content_features, compute_content_phishing_score, compute_content_similarity
from visual import (
    capture_screenshot, compute_image_similarity,
    compute_visual_similarity_with_fallback, screenshot_to_base64,
)

logger = logging.getLogger("phishvision.scanner")


def get_target_brands(db: Session) -> List[Dict]:
    brands = db.query(TargetBrand).filter(TargetBrand.active == True).all()
    return [
        {
            "name": b.name,
            "domain": b.domain,
            "login_url": b.login_url,
            "keywords": b.keywords or [],
        }
        for b in brands
    ]


def determine_verdict(score: float) -> tuple:
    """Return (verdict, confidence) from overall phishing score."""
    if score >= 0.80:
        return "phishing", "high"
    elif score >= 0.65:
        return "phishing", "medium"
    elif score >= 0.50:
        return "suspicious", "medium"
    elif score >= 0.35:
        return "suspicious", "low"
    else:
        return "safe", "high" if score < 0.20 else "medium"


def find_target_brand(url_features: Dict, target_brands: List[Dict], scanned_domain: str) -> Optional[Dict]:
    """
    Find the most likely brand being impersonated.
    IMPORTANT: Never flag a domain as impersonating itself.
    e.g. microsoft.com should NOT show 'Impersonating Microsoft'.
    """
    import tldextract
    # Extract the core registered domain being scanned
    ext = tldextract.extract(scanned_domain)
    scanned_core = ext.domain.lower()  # e.g. "microsoft" from "microsoft.com"
    scanned_full = f"{ext.domain}.{ext.suffix}".lower()  # e.g. "microsoft.com"

    closest_brand_name = url_features.get("closest_brand")

    for brand in target_brands:
        brand_ext = tldextract.extract(brand["domain"])
        brand_core = brand_ext.domain.lower()
        brand_full = brand["domain"].lower()

        # Skip if scanned domain IS this brand's exact domain
        if scanned_core == brand_core or scanned_full == brand_full:
            return None

        if brand["name"] == closest_brand_name:
            # Only flag impersonation if edit distance > 0 (not the real domain)
            edit_dist = url_features.get("min_brand_edit_distance", 999)
            if edit_dist == 0:
                return None  # Exact match = it IS the real brand
            return brand

    return None


async def scan_domain(
    url: str,
    db: Session,
    enable_screenshot: bool = True,
    is_auto_scan: bool = False,
    job_id: Optional[str] = None,
    client_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full phishing analysis pipeline for a single domain/URL.
    Returns a complete scan result dict.
    """
    start_time = time.time()
    target_brands = get_target_brands(db)

    # Normalize URL
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    from urllib.parse import urlparse
    import tldextract
    parsed = urlparse(url)
    domain = parsed.netloc or url
    ext = tldextract.extract(url)
    clean_domain = f"{ext.domain}.{ext.suffix}" if ext.suffix else domain

    logger.info(f"Starting scan: {url}")

    result = {
        "domain": clean_domain,
        "url": url,
        "target_brand": None,
        "overall_score": 0.0,
        "url_score": 0.0,
        "whois_score": 0.0,
        "content_score": 0.0,
        "visual_score": 0.0,
        "dns_score": 0.0,
        "verdict": "unknown",
        "confidence": "low",
        "url_features": {},
        "whois_data": {},
        "dns_data": {},
        "content_features": {},
        "visual_features": {},
        "ml_features": {},
        "screenshot_path": None,
        "scan_duration_ms": 0,
        "error_message": None,
        "scanned_at": datetime.utcnow().isoformat(),
    }

    errors = []

    # ── Step 1: URL Feature Analysis ────────────────────────────────────────
    try:
        url_features = extract_url_features(url, target_brands)
        url_score = compute_url_phishing_score(url_features)
        result["url_features"] = url_features
        result["url_score"] = url_score

        # Find impersonated brand — pass clean_domain so we never flag the real site
        target = find_target_brand(url_features, target_brands, clean_domain)
        if target:
            result["target_brand"] = target["name"]
    except Exception as e:
        errors.append(f"URL analysis failed: {e}")
        url_score = 0.3  # Default moderate risk if analysis fails

    # ── Step 2: WHOIS + DNS ──────────────────────────────────────────────────
    whois_score = 0.0
    try:
        whois_data = safe_whois(clean_domain)
        dns_data = get_dns_records(clean_domain)
        whois_score = compute_whois_score(whois_data, dns_data)
        result["whois_data"] = whois_data
        result["dns_data"] = dns_data
        result["whois_score"] = whois_score
        result["dns_score"] = whois_score  # Derived together
    except Exception as e:
        errors.append(f"WHOIS/DNS analysis failed: {e}")
        whois_score = 0.3

    # ── Step 3: Content Analysis ─────────────────────────────────────────────
    content_score = 0.0
    try:
        html, final_url, status_code = fetch_page(url)
        if html:
            content_features = extract_content_features(html, final_url or url)
            content_score = compute_content_phishing_score(content_features)

            # If we have a target brand, compare against its login page
            if result["target_brand"] and target:
                try:
                    target_html, _, _ = fetch_page(target.get("login_url", f"https://{target['domain']}"))
                    if target_html:
                        target_features = extract_content_features(target_html, target.get("login_url", ""))
                        similarity = compute_content_similarity(content_features, target_features)
                        content_features["target_similarity"] = similarity
                        # Blend: base score + similarity boost
                        content_score = min(1.0, (content_score * 0.6) + (similarity * 0.4))
                except Exception:
                    pass  # Gracefully skip target comparison

            result["content_features"] = content_features
            result["content_score"] = round(content_score, 4)
        else:
            result["content_features"] = {"error": f"http_{status_code}"}
            content_score = 0.2
    except Exception as e:
        errors.append(f"Content analysis failed: {e}")
        content_score = 0.2

    # ── Step 4: Visual Screenshot Analysis ──────────────────────────────────
    visual_score = 0.0
    try:
        if result["target_brand"] and target and target.get("login_url"):
            # Use the new fallback-aware function — always produces a score
            visual_result = await compute_visual_similarity_with_fallback(
                suspect_url=url,
                target_url=target["login_url"],
                enable_screenshot=enable_screenshot,
            )
            visual_score = visual_result.get("similarity_score", 0.0)
            result["visual_features"] = visual_result
            result["visual_score"] = visual_score
            # Store screenshot path if captured
            if visual_result.get("screenshot_path"):
                result["screenshot_path"] = visual_result["screenshot_path"]
        else:
            result["visual_features"] = {"note": "no_target_brand_for_comparison"}
    except Exception as e:
        errors.append(f"Visual analysis failed: {e}")
        logger.error(f"Visual analysis error: {e}")

    # ── Step 5: Ensemble Scoring ──────────────────────────────────────────────
    # Weights: URL(30%) + WHOIS(25%) + Content(30%) + Visual(15%)
    # If visual unavailable, redistribute weight to others
    if visual_score > 0:
        overall = (
            url_score * 0.30 +
            whois_score * 0.25 +
            content_score * 0.30 +
            visual_score * 0.15
        )
    else:
        overall = (
            url_score * 0.35 +
            whois_score * 0.30 +
            content_score * 0.35
        )

    result["overall_score"] = round(min(overall, 1.0), 4)

    verdict, confidence = determine_verdict(result["overall_score"])
    result["verdict"] = verdict
    result["confidence"] = confidence

    if errors:
        result["error_message"] = "; ".join(errors)

    result["scan_duration_ms"] = int((time.time() - start_time) * 1000)

    # ── Persist to DB ─────────────────────────────────────────────────────────
    try:
        db_record = ScanResult(
            domain=result["domain"],
            url=result["url"],
            target_brand=result["target_brand"],
            overall_score=result["overall_score"],
            url_score=result["url_score"],
            whois_score=result["whois_score"],
            content_score=result["content_score"],
            visual_score=result["visual_score"],
            dns_score=result["dns_score"],
            verdict=result["verdict"],
            confidence=result["confidence"],
            url_features=result["url_features"],
            whois_data=result["whois_data"],
            dns_data=result["dns_data"],
            content_features=result["content_features"],
            visual_features=result["visual_features"],
            screenshot_path=result["screenshot_path"],
            scan_duration_ms=result["scan_duration_ms"],
            error_message=result["error_message"],
            is_auto_scan=is_auto_scan,
            client_id=client_id,
        )
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        result["id"] = db_record.id
    except Exception as e:
        logger.error(f"DB persist failed: {e}")
        result["id"] = None

    logger.info(
        f"Scan complete: {url} → {result['verdict']} "
        f"(score={result['overall_score']}, {result['scan_duration_ms']}ms)"
    )
    return result


async def scan_bulk(
    urls: List[str],
    db: Session,
    enable_screenshot: bool = False,
    is_auto_scan: bool = True,
) -> Dict[str, Any]:
    """Scan multiple domains concurrently with job tracking."""
    job_id = str(uuid.uuid4())

    job = ScanJob(
        job_id=job_id,
        status="running",
        total_domains=len(urls),
        scanned_domains=0,
        phishing_found=0,
        source="bulk_upload" if not is_auto_scan else "auto_scan",
    )
    db.add(job)
    db.commit()

    results = []
    phishing_count = 0

    for i, url in enumerate(urls):
        try:
            result = await scan_domain(url, db, enable_screenshot=enable_screenshot, is_auto_scan=is_auto_scan)
            results.append(result)
            if result["verdict"] == "phishing":
                phishing_count += 1
        except Exception as e:
            logger.error(f"Bulk scan error for {url}: {e}")
            results.append({"url": url, "error": str(e), "verdict": "error"})

        # Update job progress
        try:
            db.query(ScanJob).filter(ScanJob.job_id == job_id).update({
                "scanned_domains": i + 1,
                "phishing_found": phishing_count,
            })
            db.commit()
        except Exception:
            pass

    # Mark job complete
    try:
        db.query(ScanJob).filter(ScanJob.job_id == job_id).update({
            "status": "completed",
            "completed_at": datetime.utcnow(),
            "phishing_found": phishing_count,
        })
        db.commit()
    except Exception:
        pass

    return {
        "job_id": job_id,
        "total": len(urls),
        "completed": len(results),
        "phishing_found": phishing_count,
        "results": results,
    }


async def fetch_newly_registered_domains(limit: int = 100) -> List[str]:
    """
    Fetch newly registered domains from open-source certificate transparency feeds.
    Uses crt.sh as a free, reliable source.
    """
    import httpx
    domains = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Query crt.sh for recent certificates (last 24h)
            resp = await client.get(
                "https://crt.sh/?output=json&q=%.com&limit=100",
                headers={"Accept": "application/json"},
            )
            if resp.status_code == 200:
                data = resp.json()
                seen = set()
                for entry in data[:limit]:
                    name = entry.get("name_value", "").strip()
                    # Filter out wildcards and known CDNs
                    if name.startswith("*") or "cloudflare" in name or "amazonaws" in name:
                        continue
                    if name not in seen:
                        seen.add(name)
                        domains.append(name)
    except Exception as e:
        logger.warning(f"Failed to fetch newly registered domains: {e}")

    # Fallback: return sample suspicious-looking domains for demo
    if not domains:
        domains = [
            "secure-paypal-verify.com",
            "amazon-order-confirm.net",
            "google-account-secure.xyz",
            "microsoft-login-verify.tk",
            "bankofamerica-secure.ml",
        ]

    return domains[:limit]
