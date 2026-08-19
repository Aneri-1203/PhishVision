"""
PhishVision Visual Similarity Module
Compares screenshots of web pages using perceptual hashing and SSIM.
"""
import os
import io
import logging
import hashlib
import asyncio
from typing import Optional, Tuple, Dict, Any
from pathlib import Path

logger = logging.getLogger("phishvision.visual")

SCREENSHOTS_DIR = Path(__file__).parent / "screenshots"
SCREENSHOTS_DIR.mkdir(exist_ok=True)


def _try_import_visual_libs():
    """Gracefully import visual libraries, return availability flags."""
    libs = {"PIL": False, "imagehash": False, "numpy": False, "scipy": False}
    try:
        from PIL import Image
        libs["PIL"] = True
    except ImportError:
        pass
    try:
        import imagehash
        libs["imagehash"] = True
    except ImportError:
        pass
    try:
        import numpy
        libs["numpy"] = True
    except ImportError:
        pass
    try:
        from scipy.spatial.distance import hamming
        libs["scipy"] = True
    except ImportError:
        pass
    return libs


async def capture_screenshot(url: str, timeout: int = 30) -> Optional[str]:
    """
    Capture a screenshot of the URL using Playwright.
    Returns path to saved PNG or None on failure.
    """
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    safe_name = hashlib.md5(url.encode()).hexdigest()
    output_path = str(SCREENSHOTS_DIR / f"{safe_name}.png")

    # Return cached screenshot if it exists and is recent (< 1 hour)
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
            await page.wait_for_timeout(2000)  # Extra wait for dynamic content
            await page.screenshot(path=output_path, full_page=False)
            await browser.close()
            return output_path

    except ImportError:
        logger.warning("Playwright not installed. Screenshot capture unavailable.")
        return None
    except Exception as e:
        logger.warning(f"Screenshot capture failed for {url}: {e}")
        return None


def compute_image_similarity(img_path_a: str, img_path_b: str) -> Dict[str, Any]:
    """
    Compute visual similarity between two screenshots.
    Uses perceptual hashing (pHash) and average hash.
    Returns similarity score and hash distance details.
    """
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
        result["error"] = "PIL or imagehash not available"
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

        # Perceptual hash (best for visual similarity)
        phash_a = imagehash.phash(img_a, hash_size=16)
        phash_b = imagehash.phash(img_b, hash_size=16)
        phash_dist = phash_a - phash_b
        result["phash_distance"] = phash_dist

        # Average hash
        ahash_a = imagehash.average_hash(img_a)
        ahash_b = imagehash.average_hash(img_b)
        ahash_dist = ahash_a - ahash_b
        result["ahash_distance"] = ahash_dist

        # Difference hash
        dhash_a = imagehash.dhash(img_a)
        dhash_b = imagehash.dhash(img_b)
        dhash_dist = dhash_a - dhash_b
        result["dhash_distance"] = dhash_dist

        # Combine into similarity score (0.0–1.0)
        max_hash_bits = 16 * 16  # hash_size^2
        phash_sim = 1.0 - (phash_dist / max_hash_bits)
        ahash_sim = 1.0 - (ahash_dist / 64)
        dhash_sim = 1.0 - (dhash_dist / 64)

        # Try SSIM if numpy is available
        ssim_sim = None
        if libs["numpy"]:
            try:
                import numpy as np
                arr_a = np.array(img_a.resize((256, 256))).astype(float)
                arr_b = np.array(img_b.resize((256, 256))).astype(float)

                # Simple normalized cross-correlation as SSIM proxy
                mean_a, mean_b = arr_a.mean(), arr_b.mean()
                std_a, std_b = arr_a.std(), arr_b.std()
                if std_a > 0 and std_b > 0:
                    correlation = np.mean((arr_a - mean_a) * (arr_b - mean_b)) / (std_a * std_b)
                    ssim_sim = max(0.0, float(correlation))
                    result["method"] = "phash+ssim"
                else:
                    result["method"] = "phash"
            except Exception:
                result["method"] = "phash"
        else:
            result["method"] = "phash"

        # Weighted combination
        weights = [0.40, 0.25, 0.20, 0.15] if ssim_sim is not None else [0.45, 0.30, 0.25]
        sims = [phash_sim, ahash_sim, dhash_sim]
        if ssim_sim is not None:
            sims.append(ssim_sim)

        combined = sum(s * w for s, w in zip(sims, weights))
        result["similarity_score"] = round(max(0.0, min(1.0, combined)), 4)

    except Exception as e:
        result["error"] = str(e)[:200]

    return result


def screenshot_to_base64(path: str) -> Optional[str]:
    """Convert a screenshot file to a base64 data URL for API responses."""
    if not path or not os.path.exists(path):
        return None
    try:
        import base64
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        return f"data:image/png;base64,{data}"
    except Exception:
        return None
