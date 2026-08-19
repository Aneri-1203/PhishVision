"""
PhishVision ML Model — URL Feature Extraction + Ensemble Scoring
Uses heuristic features when sklearn model is not yet trained.
"""
import re
import math
import json
import hashlib
import tldextract
from urllib.parse import urlparse
from typing import Dict, Any, Optional


# ── Typosquatting / homograph substitution map ──────────────────────────────
HOMOGLYPHS = {
    'a': ['@', '4', 'а'],  # Cyrillic а
    'e': ['3', 'е'],
    'i': ['1', 'l', '|', 'і'],
    'o': ['0', 'о'],
    's': ['5', '$'],
    'g': ['9', 'q'],
    'b': ['6'],
    't': ['7'],
    'z': ['2'],
}

SUSPICIOUS_TLDS = {
    'tk', 'ml', 'ga', 'cf', 'gq', 'pw', 'top', 'xyz', 'click',
    'link', 'online', 'site', 'website', 'tech', 'live', 'stream',
    'win', 'bid', 'loan', 'party', 'review', 'trade', 'racing',
    'accountant', 'science', 'date', 'faith', 'download',
}

SUSPICIOUS_KEYWORDS = [
    'login', 'signin', 'secure', 'account', 'update', 'verify',
    'confirm', 'banking', 'payment', 'paypal', 'ebay', 'amazon',
    'apple', 'microsoft', 'google', 'facebook', 'support', 'helpdesk',
    'invoice', 'billing', 'suspend', 'unusual', 'activity', 'validate',
    'alert', 'warning', 'limited', 'access', 'credential', 'password',
    'reset', 'unlock', 'restore', 'recovery', 'webscr', 'cmd=',
    'token', 'auth', 'wallet', 'crypto', 'withdraw', 'bonus',
]


def calculate_entropy(text: str) -> float:
    """Shannon entropy of a string."""
    if not text:
        return 0.0
    freq = {}
    for ch in text:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(text)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


def count_homoglyphs(domain: str) -> int:
    count = 0
    lower = domain.lower()
    for char, substitutes in HOMOGLYPHS.items():
        for sub in substitutes:
            count += lower.count(sub)
    return count


def levenshtein_distance(s1: str, s2: str) -> int:
    """Compute edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]


def extract_url_features(url: str, target_domains: list = None) -> Dict[str, Any]:
    """Extract comprehensive URL-based phishing features."""
    features = {}
    try:
        parsed = urlparse(url if url.startswith('http') else f'http://{url}')
        ext = tldextract.extract(url)

        full_domain = parsed.netloc.lower()
        subdomain = ext.subdomain
        domain = ext.domain
        suffix = ext.suffix
        path = parsed.path
        query = parsed.query

        # ── Basic length features ──────────────────────────────────────────
        features['url_length'] = len(url)
        features['domain_length'] = len(full_domain)
        features['path_length'] = len(path)
        features['query_length'] = len(query)
        features['subdomain_count'] = len(subdomain.split('.')) if subdomain else 0

        # ── Special character counts ───────────────────────────────────────
        features['dots_in_url'] = url.count('.')
        features['hyphens_in_domain'] = full_domain.count('-')
        features['underscores_in_url'] = url.count('_')
        features['at_signs'] = url.count('@')
        features['double_slash'] = url.count('//')
        features['question_marks'] = url.count('?')
        features['equals_signs'] = url.count('=')
        features['ampersands'] = url.count('&')
        features['percent_signs'] = url.count('%')
        features['hash_signs'] = url.count('#')
        features['tildes'] = url.count('~')

        # ── Entropy ───────────────────────────────────────────────────────
        features['domain_entropy'] = round(calculate_entropy(domain), 4)
        features['url_entropy'] = round(calculate_entropy(url), 4)

        # ── TLD analysis ──────────────────────────────────────────────────
        features['tld'] = suffix
        features['is_suspicious_tld'] = int(suffix in SUSPICIOUS_TLDS)
        features['tld_length'] = len(suffix)

        # ── Protocol ─────────────────────────────────────────────────────
        features['uses_https'] = int(parsed.scheme == 'https')
        features['has_port'] = int(bool(parsed.port))
        features['port'] = parsed.port or 0

        # ── IP address as domain ──────────────────────────────────────────
        ip_pattern = re.compile(r'^\d{1,3}(\.\d{1,3}){3}$')
        features['is_ip_domain'] = int(bool(ip_pattern.match(full_domain.split(':')[0])))

        # ── Suspicious keywords ───────────────────────────────────────────
        url_lower = url.lower()
        features['suspicious_keyword_count'] = sum(
            1 for kw in SUSPICIOUS_KEYWORDS if kw in url_lower
        )
        features['has_login_keyword'] = int(any(
            kw in url_lower for kw in ['login', 'signin', 'logon']
        ))
        features['has_banking_keyword'] = int(any(
            kw in url_lower for kw in ['bank', 'payment', 'billing', 'invoice']
        ))

        # ── Homoglyphs ────────────────────────────────────────────────────
        features['homoglyph_count'] = count_homoglyphs(full_domain)

        # ── Brand impersonation (closest target match) ────────────────────
        min_distance = 999
        closest_brand = None
        if target_domains:
            for brand in target_domains:
                brand_core = tldextract.extract(brand['domain']).domain
                dist = levenshtein_distance(domain.lower(), brand_core.lower())
                if dist < min_distance:
                    min_distance = dist
                    closest_brand = brand['name']

        features['min_brand_edit_distance'] = min_distance if min_distance < 999 else -1
        features['closest_brand'] = closest_brand
        features['brand_keyword_in_subdomain'] = int(
            any(kw in subdomain.lower() for brand in (target_domains or [])
                for kw in brand.get('keywords', []))
        )

        # ── Redirect / obfuscation indicators ────────────────────────────
        features['has_redirect'] = int('redirect' in url_lower or 'url=' in url_lower)
        features['has_url_shortener'] = int(any(
            s in full_domain for s in [
                'bit.ly', 'tinyurl', 'goo.gl', 't.co', 'ow.ly',
                'is.gd', 'buff.ly', 'adf.ly', 'shorturl',
            ]
        ))
        features['has_data_uri'] = int(url_lower.startswith('data:'))
        features['has_javascript_uri'] = int(url_lower.startswith('javascript:'))

        # ── Domain age indicator via creation year in name ────────────────
        year_match = re.search(r'(19|20)\d{2}', domain)
        features['has_year_in_domain'] = int(bool(year_match))

        # ── Number of digits in domain ────────────────────────────────────
        features['digit_ratio_in_domain'] = round(
            sum(c.isdigit() for c in domain) / max(len(domain), 1), 4
        )

        # ── Consecutive vowel/consonant patterns (looks auto-generated) ──
        vowels = sum(1 for c in domain.lower() if c in 'aeiou')
        features['vowel_ratio'] = round(vowels / max(len(domain), 1), 4)

    except Exception as e:
        features['extraction_error'] = str(e)

    return features


def compute_url_phishing_score(features: Dict[str, Any]) -> float:
    """
    Rule-based scoring using extracted URL features.
    Returns a score between 0.0 (safe) and 1.0 (phishing).
    """
    score = 0.0
    weights = []

    def add(value: float, weight: float):
        weights.append(weight)
        score_list.append(value * weight)

    score_list = []

    # High-signal features
    add(min(features.get('url_length', 0) / 200, 1.0), 0.06)
    add(float(features.get('is_ip_domain', 0)), 0.12)
    add(float(features.get('is_suspicious_tld', 0)), 0.10)
    add(min(features.get('suspicious_keyword_count', 0) / 5, 1.0), 0.10)
    add(float(features.get('has_login_keyword', 0)), 0.06)
    add(min(features.get('hyphens_in_domain', 0) / 4, 1.0), 0.06)
    add(min(features.get('subdomain_count', 0) / 4, 1.0), 0.07)
    add(min(features.get('dots_in_url', 0) / 8, 1.0), 0.05)
    add(float(features.get('has_url_shortener', 0)), 0.08)
    add(float(features.get('at_signs', 0) > 0), 0.08)
    add(float(features.get('double_slash', 0) > 1), 0.05)
    add(min(features.get('percent_signs', 0) / 4, 1.0), 0.04)
    add(min(features.get('homoglyph_count', 0) / 3, 1.0), 0.09)
    add(float(features.get('has_redirect', 0)), 0.05)
    add(1.0 - features.get('vowel_ratio', 0.4), 0.04)  # Low vowels = random-looking
    add(features.get('digit_ratio_in_domain', 0), 0.05)

    # Brand distance bonus
    edit_dist = features.get('min_brand_edit_distance', -1)
    if 0 < edit_dist <= 3:
        add(1.0 - (edit_dist / 4), 0.12)
    elif edit_dist == 0:
        add(0.0, 0.12)  # Exact match = legitimate
    else:
        add(0.0, 0.12)

    total_weight = sum(weights)
    if total_weight == 0:
        return 0.0
    return round(min(sum(score_list) / total_weight, 1.0), 4)
