"""
PhishVision WHOIS & DNS Intelligence Module
"""
import re
import socket
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

import dns.resolver
import dns.exception

logger = logging.getLogger("phishvision.whois")

# Registrars commonly abused for phishing (not definitive, used as signal)
ABUSED_REGISTRARS = [
    'namecheap', 'namesilo', 'name.com', 'godaddy', 'enom',
    'tucows', 'pdr', 'publicdomainregistry', 'bizcn', 'west263',
    'hichina', 'net4india', 'resellerclub',
]

LEGITIMATE_REGISTRARS = [
    'csr corporation', 'verisign', 'markmonitor', 'afilias',
    'register.com', 'network solutions', 'google llc',
]


def safe_whois(domain: str) -> Dict[str, Any]:
    """
    Perform WHOIS lookup with graceful degradation.
    Returns structured dict even on failure.
    """
    result = {
        "domain": domain,
        "registrar": None,
        "creation_date": None,
        "expiration_date": None,
        "updated_date": None,
        "name_servers": [],
        "status": [],
        "registrant_country": None,
        "domain_age_days": None,
        "days_until_expiry": None,
        "whois_available": False,
        "error": None,
    }

    try:
        import whois
        w = whois.whois(domain)
        result["whois_available"] = True

        result["registrar"] = str(w.registrar) if w.registrar else None

        # Handle list or single value for dates
        def parse_date(val):
            if isinstance(val, list):
                val = val[0]
            if isinstance(val, datetime):
                return val
            if isinstance(val, str):
                for fmt in ('%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%d-%b-%Y'):
                    try:
                        return datetime.strptime(val[:len(fmt)], fmt)
                    except Exception:
                        pass
            return None

        creation = parse_date(w.creation_date)
        expiration = parse_date(w.expiration_date)
        updated = parse_date(w.updated_date)

        now = datetime.utcnow()

        if creation:
            result["creation_date"] = creation.isoformat()
            result["domain_age_days"] = (now - creation).days

        if expiration:
            result["expiration_date"] = expiration.isoformat()
            result["days_until_expiry"] = (expiration - now).days

        if updated:
            result["updated_date"] = updated.isoformat()

        if w.name_servers:
            ns = w.name_servers
            if isinstance(ns, list):
                result["name_servers"] = [str(n).lower() for n in ns]
            else:
                result["name_servers"] = [str(ns).lower()]

        if w.status:
            st = w.status
            result["status"] = st if isinstance(st, list) else [st]

        if hasattr(w, 'country') and w.country:
            result["registrant_country"] = str(w.country)

    except Exception as e:
        result["error"] = str(e)[:200]

    return result


def get_dns_records(domain: str) -> Dict[str, Any]:
    """Collect DNS records for phishing signal analysis."""
    records = {
        "a_records": [],
        "mx_records": [],
        "ns_records": [],
        "txt_records": [],
        "has_spf": False,
        "has_dmarc": False,
        "has_dkim_hint": False,
        "resolves": False,
        "ip_addresses": [],
        "error": None,
    }

    resolver = dns.resolver.Resolver()
    resolver.timeout = 5
    resolver.lifetime = 5

    try:
        # A records
        try:
            answers = resolver.resolve(domain, 'A')
            records["a_records"] = [r.address for r in answers]
            records["ip_addresses"] = records["a_records"]
            records["resolves"] = True
        except (dns.exception.DNSException, Exception):
            pass

        # MX records
        try:
            answers = resolver.resolve(domain, 'MX')
            records["mx_records"] = [str(r.exchange).rstrip('.') for r in answers]
        except (dns.exception.DNSException, Exception):
            pass

        # NS records
        try:
            answers = resolver.resolve(domain, 'NS')
            records["ns_records"] = [str(r.target).rstrip('.') for r in answers]
        except (dns.exception.DNSException, Exception):
            pass

        # TXT records (SPF / DMARC hints)
        try:
            answers = resolver.resolve(domain, 'TXT')
            for r in answers:
                txt = str(r).lower()
                records["txt_records"].append(txt[:200])
                if 'spf' in txt or 'v=spf' in txt:
                    records["has_spf"] = True
                if 'dkim' in txt:
                    records["has_dkim_hint"] = True

            # DMARC
            try:
                dmarc = resolver.resolve(f'_dmarc.{domain}', 'TXT')
                for r in dmarc:
                    if 'dmarc' in str(r).lower():
                        records["has_dmarc"] = True
            except Exception:
                pass

        except (dns.exception.DNSException, Exception):
            pass

    except Exception as e:
        records["error"] = str(e)[:200]

    return records


def compute_whois_score(whois_data: Dict, dns_data: Dict) -> float:
    """
    Compute phishing probability based on WHOIS + DNS signals.
    Returns 0.0 (safe) – 1.0 (phishing).
    """
    score = 0.0
    factors = []

    # Domain age: newly registered = high risk
    age_days = whois_data.get("domain_age_days")
    if age_days is None:
        factors.append(0.6)   # Unknown age is suspicious
    elif age_days < 7:
        factors.append(1.0)
    elif age_days < 30:
        factors.append(0.85)
    elif age_days < 90:
        factors.append(0.55)
    elif age_days < 365:
        factors.append(0.25)
    elif age_days < 730:
        factors.append(0.10)
    elif age_days < 1825:  # < 5 years
        factors.append(0.05)
    else:                   # 5+ years old = very established
        factors.append(0.0)

    # Short expiry = throwaway domain
    expiry = whois_data.get("days_until_expiry")
    if expiry is not None:
        if expiry < 30:
            factors.append(0.9)
        elif expiry < 90:
            factors.append(0.5)
        elif expiry < 365:
            factors.append(0.2)
        elif expiry > 730:   # 2+ years left = established, trusted
            factors.append(0.0)
        else:
            factors.append(0.05)
    else:
        factors.append(0.4)

    # Registrar reputation
    registrar = (whois_data.get("registrar") or "").lower()
    if any(r in registrar for r in ABUSED_REGISTRARS):
        factors.append(0.5)
    elif any(r in registrar for r in LEGITIMATE_REGISTRARS):
        factors.append(0.0)
    else:
        factors.append(0.3)

    # DNS health
    if not dns_data.get("resolves"):
        factors.append(0.3)
    else:
        factors.append(0.0)

    # No SPF / DMARC = no email security = possible phishing infra
    if not dns_data.get("has_spf") and not dns_data.get("has_dmarc"):
        factors.append(0.4)
    elif not dns_data.get("has_dmarc"):
        factors.append(0.2)
    else:
        factors.append(0.0)

    # WHOIS not available at all
    if not whois_data.get("whois_available"):
        factors.append(0.5)
    else:
        factors.append(0.0)

    weights = [0.35, 0.15, 0.15, 0.10, 0.15, 0.10]
    score = sum(f * w for f, w in zip(factors, weights))
    return round(min(score, 1.0), 4)
