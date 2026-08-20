"""
PhishVision Visual Similarity Module
Primary: Playwright screenshots + perceptual hashing (pHash/aHash/dHash/SSIM)
Fallback: HTML structure fingerprint + CSS color/font analysis when screenshots unavailable
"""
import os
import re
import io
import logging
import hashlib
import asyncio
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger("phishvision.visual")

SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"
SCREENSHOTS_DIR.mkdir(exist_ok=True)


# ── Library availability ──────────────────────────────────────────────────────
def _try_import_visual_libs():
    libs = {"PIL": False, "imagehash": False, "numpy": False}
    try:
        from PIL import Image; libs["PIL"] = True
    except ImportError:
        pass
    try:
        import imagehash; libs["imagehash"] = True
    except ImportError:
        pass
    try:
        import numpy; libs["numpy"] = True
    except ImportError:
        pass
    return libs


# ── Screenshot capture ────────────────────────────────────────────────────────
async def capture_screenshot(url: str, timeout: int = 30) -> Optional[str]:
    """
    Capture screenshot via Playwright (headless Chromium).
    Returns path to PNG or None on failure.
    """
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    safe_name = hashlib.md5(url.encode()).hexdigest()
    output_path = str(SCREENSHOTS_DIR / f"{safe_name}.png")

    # Use cached if < 1 hour old
    if os.path.exists(output_path):
        import time
        if time.time() - os.path.getmtime(output_path) < 3600:
            return output_path

    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            )
            context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                ignore_https_errors=True,
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()
            await page.goto(url, timeout=timeout * 1000, wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            await page.screenshot(path=output_path, full_page=False)
            await browser.close()
            logger.info(f"Screenshot captured: {output_path}")
            return output_path

    except Exception as e:
        logger.warning(f"Screenshot capture failed for {url}: {e}")
        return None


# ── Image-based similarity (when screenshots exist) ───────────────────────────
def compute_image_similarity(img_path_a: str, img_path_b: str) -> Dict[str, Any]:
    """Perceptual hash + SSIM comparison between two screenshots."""
    result = {
        "similarity_score": 0.0,
        "phash_distance": None,
        "ahash_distance": None,
        "dhash_distance": None,
        "method": "unavailable",
        "error": None,
    }

    libs = _try_import_visual_libs()
    if not libs["PIL"] or not libs["imagehash"]:
        result["error"] = "PIL/imagehash not available"
        return result
    if not img_path_a or not img_path_b:
        result["error"] = "missing image paths"
        return result
    if not os.path.exists(img_path_a) or not os.path.exists(img_path_b):
        result["error"] = "image files not found"
        return result

    try:
        from PIL import Image
        import imagehash

        img_a = Image.open(img_path_a).convert("RGB").resize((800, 600))
        img_b = Image.open(img_path_b).convert("RGB").resize((800, 600))

        phash_a = imagehash.phash(img_a, hash_size=16)
        phash_b = imagehash.phash(img_b, hash_size=16)
        phash_dist = phash_a - phash_b
        result["phash_distance"] = phash_dist

        ahash_a = imagehash.average_hash(img_a)
        ahash_b = imagehash.average_hash(img_b)
        ahash_dist = ahash_a - ahash_b
        result["ahash_distance"] = ahash_dist

        dhash_a = imagehash.dhash(img_a)
        dhash_b = imagehash.dhash(img_b)
        dhash_dist = dhash_a - dhash_b
        result["dhash_distance"] = dhash_dist

        max_bits = 16 * 16
        phash_sim = max(0.0, 1.0 - (phash_dist / max_bits))
        ahash_sim = max(0.0, 1.0 - (ahash_dist / 64))
        dhash_sim = max(0.0, 1.0 - (dhash_dist / 64))

        ssim_sim = None
        if libs["numpy"]:
            try:
                import numpy as np
                arr_a = np.array(img_a.resize((256, 256))).astype(float)
                arr_b = np.array(img_b.resize((256, 256))).astype(float)
                mean_a, mean_b = arr_a.mean(), arr_b.mean()
                std_a, std_b = arr_a.std(), arr_b.std()
                if std_a > 0 and std_b > 0:
                    corr = np.mean((arr_a - mean_a) * (arr_b - mean_b)) / (std_a * std_b)
                    ssim_sim = max(0.0, float(corr))
                    result["method"] = "phash+ssim"
                else:
                    result["method"] = "phash"
            except Exception:
                result["method"] = "phash"
        else:
            result["method"] = "phash"

        if ssim_sim is not None:
            combined = phash_sim*0.40 + ahash_sim*0.25 + dhash_sim*0.20 + ssim_sim*0.15
        else:
            combined = phash_sim*0.45 + ahash_sim*0.30 + dhash_sim*0.25

        result["similarity_score"] = round(max(0.0, min(1.0, combined)), 4)

    except Exception as e:
        result["error"] = str(e)[:200]

    return result


# ── HTML fingerprint similarity (fallback when no screenshots) ────────────────
def _extract_html_fingerprint(html: str, url: str = "") -> Dict:
    """
    Extract a visual fingerprint from HTML without rendering.
    Captures: color palette, font families, layout structure, brand keywords,
    form structure, logo presence, and CSS patterns.
    """
    if not html:
        return {}

    fp = {}
    html_lower = html.lower()

    # ── Color palette from inline styles and CSS ──────────────────────────
    hex_colors = re.findall(r'#([0-9a-fA-F]{6})\b', html)
    rgb_colors = re.findall(r'rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)', html)
    # Normalize hex colors to sorted top-10
    fp["colors"] = sorted(set(c.lower() for c in hex_colors))[:10]
    fp["color_count"] = len(set(hex_colors))

    # ── Font families ─────────────────────────────────────────────────────
    fonts = re.findall(r'font-family\s*:\s*([^;}"]+)', html_lower)
    fp["fonts"] = sorted(set(f.strip().split(',')[0].strip('"\'') for f in fonts))[:5]

    # ── Layout tag structure fingerprint ─────────────────────────────────
    tags = re.findall(r'<(\w+)[\s>]', html_lower)
    tag_freq = {}
    for t in tags:
        tag_freq[t] = tag_freq.get(t, 0) + 1
    fp["tag_freq"] = dict(sorted(tag_freq.items(), key=lambda x: -x[1])[:15])

    # ── Form structure ─────────────────────────────────────────────────────
    fp["form_count"]         = html_lower.count('<form')
    fp["input_count"]        = html_lower.count('<input')
    fp["password_fields"]    = html_lower.count('type="password"') + html_lower.count("type='password'")
    fp["button_count"]       = html_lower.count('<button')
    fp["submit_count"]       = html_lower.count('type="submit"') + html_lower.count("type='submit'")

    # ── Logo / brand image indicators ─────────────────────────────────────
    logo_patterns = ['logo', 'brand', 'header-img', 'site-logo', 'navbar-brand']
    fp["has_logo_img"] = any(p in html_lower for p in logo_patterns)

    # ── Navigation structure ───────────────────────────────────────────────
    fp["has_navbar"]    = '<nav' in html_lower or 'navbar' in html_lower
    fp["has_footer"]    = '<footer' in html_lower
    fp["has_sidebar"]   = 'sidebar' in html_lower
    fp["link_count"]    = html_lower.count('<a ')

    # ── Page title ────────────────────────────────────────────────────────
    title_match = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
    fp["title"] = title_match.group(1).strip()[:100] if title_match else ""

    # ── Background and primary colors from body/main CSS ──────────────────
    bg_match = re.search(r'background(?:-color)?\s*:\s*([^;}"]+)', html_lower)
    fp["bg_color"] = bg_match.group(1).strip()[:30] if bg_match else ""

    # ── External CSS/JS resources (CDN fingerprint) ───────────────────────
    cdn_patterns = ['bootstrap', 'jquery', 'tailwind', 'react', 'angular', 'vue',
                    'material', 'fontawesome', 'googleapis', 'cloudflare']
    fp["cdns"] = [c for c in cdn_patterns if c in html_lower]

    # ── Content hash of structural elements only ───────────────────────────
    structure_only = re.sub(r'>([^<]+)<', '><', html_lower)  # strip text
    structure_only = re.sub(r'\s+', ' ', structure_only)
    fp["structure_hash"] = hashlib.md5(structure_only.encode()).hexdigest()

    return fp


def compute_html_visual_similarity(fp_a: Dict, fp_b: Dict) -> Dict[str, Any]:
    """
    Compare two HTML fingerprints and return a visual similarity score.
    This is the fallback when Playwright screenshots aren't available.
    """
    result = {
        "similarity_score": 0.0,
        "method": "html-fingerprint",
        "details": {},
        "error": None,
    }

    if not fp_a or not fp_b:
        result["error"] = "missing fingerprints"
        return result

    scores = []

    # ── Color palette similarity (Jaccard) ────────────────────────────────
    colors_a = set(fp_a.get("colors", []))
    colors_b = set(fp_b.get("colors", []))
    if colors_a or colors_b:
        color_sim = len(colors_a & colors_b) / max(len(colors_a | colors_b), 1)
        scores.append(("colors", color_sim, 0.20))

    # ── Font similarity ───────────────────────────────────────────────────
    fonts_a = set(fp_a.get("fonts", []))
    fonts_b = set(fp_b.get("fonts", []))
    if fonts_a or fonts_b:
        font_sim = len(fonts_a & fonts_b) / max(len(fonts_a | fonts_b), 1)
        scores.append(("fonts", font_sim, 0.15))

    # ── CDN / framework similarity ────────────────────────────────────────
    cdns_a = set(fp_a.get("cdns", []))
    cdns_b = set(fp_b.get("cdns", []))
    if cdns_a or cdns_b:
        cdn_sim = len(cdns_a & cdns_b) / max(len(cdns_a | cdns_b), 1)
        scores.append(("cdns", cdn_sim, 0.10))

    # ── Form structure similarity ─────────────────────────────────────────
    for key, weight in [("form_count", 0.10), ("password_fields", 0.15), ("input_count", 0.08)]:
        va = fp_a.get(key, 0)
        vb = fp_b.get(key, 0)
        mx = max(va, vb, 1)
        sim = 1.0 - abs(va - vb) / mx
        scores.append((key, max(0.0, sim), weight))

    # ── Layout boolean features ────────────────────────────────────────────
    for key, weight in [("has_navbar", 0.05), ("has_footer", 0.05), ("has_logo_img", 0.07)]:
        match = int(fp_a.get(key, False) == fp_b.get(key, False))
        scores.append((key, float(match), weight))

    # ── Tag frequency cosine similarity ───────────────────────────────────
    tags_a = fp_a.get("tag_freq", {})
    tags_b = fp_b.get("tag_freq", {})
    all_tags = set(tags_a) | set(tags_b)
    if all_tags:
        dot = sum(tags_a.get(t, 0) * tags_b.get(t, 0) for t in all_tags)
        mag_a = sum(v**2 for v in tags_a.values()) ** 0.5
        mag_b = sum(v**2 for v in tags_b.values()) ** 0.5
        tag_sim = dot / max(mag_a * mag_b, 1e-9)
        scores.append(("tag_structure", min(tag_sim, 1.0), 0.10))

    # ── Structure hash exact match ─────────────────────────────────────────
    if fp_a.get("structure_hash") and fp_b.get("structure_hash"):
        match = 1.0 if fp_a["structure_hash"] == fp_b["structure_hash"] else 0.0
        scores.append(("structure_hash", match, 0.15))
        if match == 1.0:
            # Exact structural clone — very strong signal
            result["similarity_score"] = 0.97
            result["details"] = {s[0]: round(s[1], 3) for s in scores}
            return result

    if not scores:
        result["error"] = "no comparable features"
        return result

    total_weight = sum(w for _, _, w in scores)
    weighted_score = sum(s * w for _, s, w in scores) / max(total_weight, 1)

    result["similarity_score"] = round(max(0.0, min(1.0, weighted_score)), 4)
    result["details"] = {s[0]: round(s[1], 3) for s in scores}
    return result


async def compute_visual_similarity_with_fallback(
    suspect_url: str,
    target_url: str,
    enable_screenshot: bool = True,
) -> Dict[str, Any]:
    """
    Try screenshot-based comparison first.
    If Playwright isn't available or fails, use HTML fingerprint fallback.
    Always returns a non-zero result when pages are fetchable.
    """
    # ── Try screenshot path ───────────────────────────────────────────────
    if enable_screenshot:
        suspect_ss = await capture_screenshot(suspect_url)
        target_ss  = await capture_screenshot(target_url)

        if suspect_ss and target_ss:
            result = compute_image_similarity(suspect_ss, target_ss)
            if result.get("similarity_score", 0) > 0:
                result["screenshot_path"] = suspect_ss
                return result

    # ── Fallback: HTML fingerprint comparison ─────────────────────────────
    import requests
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    suspect_html = ""
    target_html  = ""

    try:
        r = requests.get(suspect_url if suspect_url.startswith('http') else f'https://{suspect_url}',
                        headers=HEADERS, timeout=8, verify=False)
        suspect_html = r.text
    except Exception as e:
        logger.debug(f"Could not fetch suspect URL for fingerprint: {e}")

    try:
        r = requests.get(target_url if target_url.startswith('http') else f'https://{target_url}',
                        headers=HEADERS, timeout=8, verify=False)
        target_html = r.text
    except Exception as e:
        logger.debug(f"Could not fetch target URL for fingerprint: {e}")

    if suspect_html and target_html:
        fp_a = _extract_html_fingerprint(suspect_html, suspect_url)
        fp_b = _extract_html_fingerprint(target_html,  target_url)
        result = compute_html_visual_similarity(fp_a, fp_b)
        result["fallback_used"] = True
        return result

    return {
        "similarity_score": 0.0,
        "method": "unavailable",
        "error": "could not fetch pages for comparison",
    }


def screenshot_to_base64(path: str) -> Optional[str]:
    """Convert a screenshot file to a base64 data URL."""
    if not path or not os.path.exists(path):
        return None
    try:
        import base64
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        return f"data:image/png;base64,{data}"
    except Exception:
        return None
