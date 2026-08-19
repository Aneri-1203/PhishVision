"""
PhishVision Content Analysis Module
Compares HTML content, forms, scripts, and text between a target and suspect page.
"""
import re
import hashlib
import logging
from typing import Dict, Any, Optional, List, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("phishvision.content")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
TIMEOUT = 10


def fetch_page(url: str) -> Tuple[Optional[str], Optional[str], int]:
    """
    Fetch a page and return (html_content, final_url, status_code).
    Returns (None, None, 0) on failure.
    """
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    # Try HTTPS first, then HTTP
    for scheme_url in [url, url.replace('https://', 'http://')]:
        try:
            resp = requests.get(
                scheme_url,
                headers=HEADERS,
                timeout=TIMEOUT,
                allow_redirects=True,
                verify=False,  # Many phishing sites have invalid certs
            )
            return resp.text, resp.url, resp.status_code
        except requests.exceptions.SSLError:
            continue
        except requests.exceptions.ConnectionError:
            continue
        except requests.exceptions.Timeout:
            return None, None, 408
        except Exception as e:
            logger.debug(f"Fetch error for {scheme_url}: {e}")
            continue

    return None, None, 0


def extract_content_features(html: str, base_url: str = "") -> Dict[str, Any]:
    """Extract structural and content features from HTML."""
    features = {
        "title": None,
        "has_login_form": False,
        "has_password_field": False,
        "has_hidden_fields": False,
        "form_action_external": False,
        "form_action_urls": [],
        "input_types": [],
        "external_links_count": 0,
        "internal_links_count": 0,
        "script_count": 0,
        "iframe_count": 0,
        "image_count": 0,
        "meta_redirect": False,
        "favicon_url": None,
        "text_content": "",
        "word_count": 0,
        "obfuscated_js": False,
        "external_resources": [],
        "copyright_text": None,
        "has_captcha": False,
        "content_hash": None,
        "structure_hash": None,
        "error": None,
    }

    if not html:
        features["error"] = "empty_html"
        return features

    try:
        soup = BeautifulSoup(html, 'html.parser')
        parsed_base = urlparse(base_url)
        base_domain = parsed_base.netloc

        # Title
        title_tag = soup.find('title')
        features["title"] = title_tag.get_text(strip=True)[:200] if title_tag else None

        # Forms analysis
        forms = soup.find_all('form')
        for form in forms:
            action = form.get('action', '')
            if action:
                full_action = urljoin(base_url, action)
                features["form_action_urls"].append(full_action[:200])
                action_domain = urlparse(full_action).netloc
                if action_domain and action_domain != base_domain:
                    features["form_action_external"] = True

            inputs = form.find_all('input')
            for inp in inputs:
                inp_type = inp.get('type', 'text').lower()
                features["input_types"].append(inp_type)
                if inp_type == 'password':
                    features["has_password_field"] = True
                if inp_type == 'hidden':
                    features["has_hidden_fields"] = True

            if any(t in (form.get_text() or '').lower() for t in ['password', 'passwd', 'pwd', 'sign in', 'log in']):
                features["has_login_form"] = True

        if features["has_password_field"]:
            features["has_login_form"] = True

        # Links
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith(('http://', 'https://')):
                link_domain = urlparse(href).netloc
                if link_domain != base_domain:
                    features["external_links_count"] += 1
                else:
                    features["internal_links_count"] += 1
            elif href.startswith('/') or not href.startswith(('javascript:', 'mailto:', '#')):
                features["internal_links_count"] += 1

        # Scripts
        scripts = soup.find_all('script')
        features["script_count"] = len(scripts)

        # Check for obfuscated JS (eval, unescape, fromCharCode patterns)
        script_text = ' '.join(s.get_text() for s in scripts if s.get_text())
        obfuscation_patterns = [r'eval\(', r'unescape\(', r'fromCharCode', r'\\x[0-9a-f]{2}', r'atob\(']
        features["obfuscated_js"] = any(re.search(p, script_text) for p in obfuscation_patterns)

        # iFrames
        features["iframe_count"] = len(soup.find_all('iframe'))

        # Images
        features["image_count"] = len(soup.find_all('img'))

        # Meta refresh redirect
        for meta in soup.find_all('meta'):
            http_equiv = meta.get('http-equiv', '').lower()
            if http_equiv == 'refresh':
                content = meta.get('content', '')
                if 'url=' in content.lower():
                    features["meta_redirect"] = True

        # Favicon
        favicon = soup.find('link', rel=lambda r: r and 'icon' in r)
        if favicon:
            features["favicon_url"] = favicon.get('href', '')

        # Text content
        for tag in soup(['script', 'style', 'head', 'meta']):
            tag.decompose()
        text = soup.get_text(separator=' ', strip=True)
        features["text_content"] = text[:5000]
        features["word_count"] = len(text.split())

        # Copyright
        copyright_match = re.search(r'©.*?(\d{4})', text)
        if copyright_match:
            features["copyright_text"] = copyright_match.group(0)[:100]

        # CAPTCHA presence
        features["has_captcha"] = bool(
            soup.find(class_=re.compile(r'captcha|recaptcha|hcaptcha', re.I)) or
            soup.find(id=re.compile(r'captcha|recaptcha', re.I))
        )

        # External resources
        for tag in soup.find_all(['script', 'link', 'img'], src=True):
            src = tag.get('src', '')
            if src.startswith(('http://', 'https://')):
                src_domain = urlparse(src).netloc
                if src_domain and src_domain != base_domain:
                    features["external_resources"].append(src_domain)

        # Content hash (detects identical cloned pages)
        cleaned_html = re.sub(r'\s+', ' ', html.lower())
        features["content_hash"] = hashlib.md5(cleaned_html.encode()).hexdigest()

        # Structure hash (tags only, ignores text — detects structural clones)
        tags = [tag.name for tag in soup.find_all()]
        features["structure_hash"] = hashlib.md5('|'.join(tags).encode()).hexdigest()

    except Exception as e:
        features["error"] = str(e)[:200]

    return features


def compute_content_similarity(features_a: Dict, features_b: Dict) -> float:
    """
    Compare two pages' content features and return similarity (0.0–1.0).
    Used to compare suspect page against known legitimate page.
    """
    if not features_a or not features_b:
        return 0.0

    score_parts = []

    # Structure hash match
    if features_a.get("structure_hash") and features_b.get("structure_hash"):
        score_parts.append((1.0 if features_a["structure_hash"] == features_b["structure_hash"] else 0.0, 0.25))

    # Form similarity
    a_inputs = sorted(features_a.get("input_types", []))
    b_inputs = sorted(features_b.get("input_types", []))
    if a_inputs or b_inputs:
        intersection = len(set(a_inputs) & set(b_inputs))
        union = len(set(a_inputs) | set(b_inputs))
        score_parts.append((intersection / max(union, 1), 0.20))

    # Title keyword overlap
    title_a = (features_a.get("title") or "").lower()
    title_b = (features_b.get("title") or "").lower()
    if title_a and title_b:
        words_a = set(title_a.split())
        words_b = set(title_b.split())
        overlap = len(words_a & words_b) / max(len(words_a | words_b), 1)
        score_parts.append((overlap, 0.20))

    # Password field presence
    pw_a = features_a.get("has_password_field", False)
    pw_b = features_b.get("has_password_field", False)
    score_parts.append((1.0 if pw_a == pw_b else 0.0, 0.15))

    # Script / iframe counts similarity
    script_a = features_a.get("script_count", 0)
    script_b = features_b.get("script_count", 0)
    max_s = max(script_a, script_b, 1)
    score_parts.append((1.0 - abs(script_a - script_b) / max_s, 0.10))

    # Text content word overlap (Jaccard)
    text_a = set((features_a.get("text_content") or "").lower().split())
    text_b = set((features_b.get("text_content") or "").lower().split())
    if text_a or text_b:
        jaccard = len(text_a & text_b) / max(len(text_a | text_b), 1)
        score_parts.append((jaccard, 0.10))

    total_weight = sum(w for _, w in score_parts)
    if total_weight == 0:
        return 0.0

    return round(sum(s * w for s, w in score_parts) / total_weight, 4)


def compute_content_phishing_score(features: Dict) -> float:
    """
    Score a single page's content for phishing indicators.
    Returns 0.0–1.0.
    """
    score_parts = []

    # Login / password form = target page
    score_parts.append((1.0 if features.get("has_password_field") else 0.0, 0.20))

    # External form action = credential harvesting
    score_parts.append((1.0 if features.get("form_action_external") else 0.0, 0.20))

    # Obfuscated JavaScript
    score_parts.append((0.8 if features.get("obfuscated_js") else 0.0, 0.15))

    # Meta redirect
    score_parts.append((0.7 if features.get("meta_redirect") else 0.0, 0.10))

    # Lots of hidden fields
    score_parts.append((0.6 if features.get("has_hidden_fields") else 0.0, 0.10))

    # Very low word count (cloned minimal page)
    wc = features.get("word_count", 100)
    if wc < 20:
        score_parts.append((0.8, 0.10))
    elif wc < 50:
        score_parts.append((0.4, 0.10))
    else:
        score_parts.append((0.0, 0.10))

    # No iframes (phishing pages usually avoid them)
    score_parts.append((0.0 if features.get("iframe_count", 0) > 2 else 0.2, 0.05))

    # Suspiciously few external links (isolated page)
    ext = features.get("external_links_count", 0)
    score_parts.append((0.5 if ext == 0 else 0.0, 0.10))

    total_weight = sum(w for _, w in score_parts)
    if total_weight == 0:
        return 0.0
    return round(min(sum(s * w for s, w in score_parts) / total_weight, 1.0), 4)
