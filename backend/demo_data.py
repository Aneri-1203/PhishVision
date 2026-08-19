"""
PhishVision Demo Data Seeder
Run this to populate the database with realistic demo scan results for the presentation.
Usage: python demo_data.py
"""
import sys
import os
import asyncio
import random
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from database import init_db, SessionLocal, ScanResult, TargetBrand
from targets import DEFAULT_TARGETS

PHISHING_SAMPLES = [
    ("secure-paypal-verify-account.xyz", "PayPal", 0.94, "phishing", "high"),
    ("amazon-order-confirm-update.net", "Amazon", 0.91, "phishing", "high"),
    ("login-microsoft-helpdesk.tk", "Microsoft", 0.88, "phishing", "high"),
    ("accounts-google-secure.ml", "Google", 0.86, "phishing", "high"),
    ("apple-id-verify-account.cf", "Apple", 0.90, "phishing", "high"),
    ("bankofamerica-secure-login.ga", "Bank of America", 0.83, "phishing", "high"),
    ("paypal-resolution-center.gq", "PayPal", 0.79, "phishing", "medium"),
    ("instagram-verify-badge.pw", "Instagram", 0.82, "phishing", "high"),
    ("netflix-billing-update.top", "Netflix", 0.78, "phishing", "medium"),
    ("chase-bank-verify.click", "Chase Bank", 0.85, "phishing", "high"),
    ("steam-trade-offer-confirm.xyz", "Steam", 0.75, "phishing", "medium"),
    ("coinbase-wallet-verify.tk", "Coinbase", 0.87, "phishing", "high"),
    ("fedex-delivery-confirm.site", "FedEx", 0.71, "phishing", "medium"),
    ("dhl-package-track.xyz", "DHL", 0.73, "phishing", "medium"),
    ("linkedin-account-restricted.pw", "LinkedIn", 0.80, "phishing", "high"),
]

SUSPICIOUS_SAMPLES = [
    ("paypal-support-center.com", "PayPal", 0.62, "suspicious", "medium"),
    ("amazon-deals-today.net", "Amazon", 0.55, "suspicious", "medium"),
    ("microsoft-tech-help.org", "Microsoft", 0.58, "suspicious", "medium"),
    ("facebook-login-help.info", "Facebook", 0.60, "suspicious", "medium"),
    ("google-verify-now.co", "Google", 0.53, "suspicious", "low"),
    ("binance-crypto-airdrop.io", "Binance", 0.65, "suspicious", "medium"),
]

SAFE_SAMPLES = [
    ("stackoverflow.com", None, 0.05, "safe", "high"),
    ("github.com", None, 0.03, "safe", "high"),
    ("mozilla.org", None, 0.04, "safe", "high"),
    ("wikipedia.org", None, 0.02, "safe", "high"),
    ("python.org", None, 0.06, "safe", "high"),
    ("npmjs.com", None, 0.07, "safe", "high"),
]


def seed_demo():
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(ScanResult).count()
        if existing > 0:
            print(f"Database already has {existing} records. Skipping seed.")
            return

        all_samples = PHISHING_SAMPLES + SUSPICIOUS_SAMPLES + SAFE_SAMPLES
        now = datetime.utcnow()

        for i, (domain, brand, score, verdict, confidence) in enumerate(all_samples):
            # Scatter over last 7 days
            days_ago = random.uniform(0, 7)
            scan_time = now - timedelta(days=days_ago)

            # Derive sub-scores from overall score with noise
            def noisy(base, noise=0.1):
                return round(max(0.0, min(1.0, base + random.uniform(-noise, noise))), 4)

            r = ScanResult(
                domain=domain,
                url=f"https://{domain}",
                target_brand=brand,
                overall_score=score,
                url_score=noisy(score, 0.12),
                whois_score=noisy(score, 0.15),
                content_score=noisy(score, 0.10),
                visual_score=noisy(score * 0.8, 0.10),
                dns_score=noisy(score, 0.12),
                verdict=verdict,
                confidence=confidence,
                url_features={
                    "url_length": random.randint(20, 80),
                    "subdomain_count": random.randint(0, 3),
                    "is_suspicious_tld": int(score > 0.6),
                    "suspicious_keyword_count": random.randint(0, 4),
                    "hyphens_in_domain": random.randint(0, 3),
                    "homoglyph_count": random.randint(0, 2),
                    "uses_https": 1,
                    "tld": domain.split('.')[-1],
                    "min_brand_edit_distance": random.randint(1, 5) if brand else -1,
                    "closest_brand": brand,
                    "domain_entropy": round(random.uniform(2.5, 4.5), 4),
                },
                whois_data={
                    "domain_age_days": random.randint(1, 30) if verdict == "phishing" else random.randint(365, 5000),
                    "registrar": random.choice(["Namecheap", "GoDaddy", "Google LLC", "NameSilo", "Tucows"]),
                    "registrant_country": random.choice(["US", "RU", "CN", "DE", "UA", None]),
                    "days_until_expiry": random.randint(10, 365),
                    "whois_available": True,
                },
                dns_data={
                    "resolves": True,
                    "has_spf": verdict == "safe",
                    "has_dmarc": verdict == "safe",
                    "a_records": [f"192.168.{random.randint(1,255)}.{random.randint(1,255)}"],
                },
                content_features={
                    "has_login_form": verdict in ("phishing", "suspicious"),
                    "has_password_field": verdict == "phishing",
                    "form_action_external": verdict == "phishing" and random.random() > 0.5,
                    "obfuscated_js": verdict == "phishing" and random.random() > 0.6,
                    "word_count": random.randint(10, 500),
                    "script_count": random.randint(0, 15),
                    "target_similarity": round(score * 0.9, 3) if brand else None,
                },
                visual_features={
                    "similarity_score": round(score * 0.85, 3) if brand else None,
                    "method": "phash+ssim",
                },
                scan_duration_ms=random.randint(800, 8000),
                is_auto_scan=random.random() > 0.5,
                scanned_at=scan_time,
            )
            db.add(r)

        db.commit()
        print(f"✅ Seeded {len(all_samples)} demo scan results")
        print(f"   - {len(PHISHING_SAMPLES)} phishing")
        print(f"   - {len(SUSPICIOUS_SAMPLES)} suspicious")
        print(f"   - {len(SAFE_SAMPLES)} safe")

    except Exception as e:
        print(f"❌ Seed failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
