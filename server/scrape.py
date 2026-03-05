#!/usr/bin/env python3
"""
scrape.py — Scrapling-powered web scraper bridge.
Called from Node.js to fetch pages that block simple HTTP requests.

Usage: python3 scrape.py <url>
Output: JSON to stdout with all extracted data.
"""

import sys
import json
import re
import logging

# Suppress Scrapling's INFO logs — they go to stdout and corrupt our JSON output
logging.disable(logging.INFO)

from scrapling.fetchers import Fetcher

def scrape_url(url):
    """Fetch a URL using Scrapling's Fetcher with browser impersonation."""
    try:
        # Fetcher impersonates Chrome's TLS fingerprint and headers
        page = Fetcher.get(url, stealthy_headers=True, follow_redirects=True, timeout=20)
    except Exception as e:
        return {"error": f"Fetch failed: {str(e)}", "url": url}

    if not page or not page.status == 200:
        status = page.status if page else 'no response'
        return {"error": f"HTTP {status}", "url": url}

    html = page.html_content if hasattr(page, 'html_content') else str(page)
    if len(html) < 200:
        return {"error": "Response too short — likely a challenge page", "url": url}

    result = {
        "url": url,
        "html_length": len(html),
        "title": "",
        "meta_description": "",
        "og_title": "",
        "og_description": "",
        "og_image": "",
        "og_type": "",
        "product_price": "",
        "body_text": "",
        "colors": [],
        "logo_candidates": [],
        "product_images": [],
        "json_ld": None,
    }

    # ── Meta extraction via Scrapling selectors ──
    title_el = page.css("title")
    if title_el:
        result["title"] = title_el[0].text.strip() if title_el[0].text else ""

    meta_desc = page.css('meta[name="description"]')
    if meta_desc:
        result["meta_description"] = meta_desc[0].attrib.get("content", "")

    og_title = page.css('meta[property="og:title"]')
    if og_title:
        result["og_title"] = og_title[0].attrib.get("content", "")

    og_desc = page.css('meta[property="og:description"]')
    if og_desc:
        result["og_description"] = og_desc[0].attrib.get("content", "")

    og_image = page.css('meta[property="og:image"]')
    if og_image:
        result["og_image"] = og_image[0].attrib.get("content", "")

    og_type = page.css('meta[property="og:type"]')
    if og_type:
        result["og_type"] = og_type[0].attrib.get("content", "")

    # ── JSON-LD structured data ──
    json_ld_scripts = page.css('script[type="application/ld+json"]')
    for script in json_ld_scripts:
        try:
            text = script.text
            if text:
                result["json_ld"] = json.loads(text)
                break
        except (json.JSONDecodeError, Exception):
            continue

    # ── Price extraction ──
    # From JSON-LD
    if result["json_ld"]:
        jld = result["json_ld"]
        if isinstance(jld, dict):
            offers = jld.get("offers", jld.get("Offers", {}))
            if isinstance(offers, dict):
                result["product_price"] = str(offers.get("price", ""))
            elif isinstance(offers, list) and offers:
                result["product_price"] = str(offers[0].get("price", ""))
    # From HTML patterns
    if not result["product_price"]:
        price_el = page.css('[class*="price"], [data-price], .product-price, .sale-price, .current-price')
        for el in price_el:
            text = el.text.strip() if el.text else ""
            m = re.search(r'[\$€£]?\s*(\d+[.,]\d{2})', text)
            if m:
                result["product_price"] = m.group(1)
                break

    # ── Logo candidates ──
    logos = set()
    # Apple touch icon
    apple_icon = page.css('link[rel="apple-touch-icon"]')
    for el in apple_icon:
        href = el.attrib.get("href", "")
        if href: logos.add(href)
    # Img tags with logo in class/id/alt/src
    for el in page.css("img"):
        attrs = " ".join([
            el.attrib.get("class", ""),
            el.attrib.get("id", ""),
            el.attrib.get("alt", ""),
            el.attrib.get("src", ""),
        ]).lower()
        if "logo" in attrs or "brand" in attrs:
            src = el.attrib.get("src") or el.attrib.get("data-src", "")
            if src: logos.add(src)
    # Favicon
    favicon = page.css('link[rel="icon"], link[rel="shortcut icon"]')
    for el in favicon:
        href = el.attrib.get("href", "")
        if href: logos.add(href)

    result["logo_candidates"] = list(logos)

    # ── Product images ──
    images = set()
    skip_words = {"logo", "icon", "favicon", "pixel", "tracking", "badge", "payment",
                  "sprite", "placeholder", "blank", "spacer", ".svg", "social", "share"}

    for el in page.css("img"):
        for attr in ["src", "data-src", "data-lazy-src", "data-original",
                      "data-image", "data-zoom-image", "data-large-image"]:
            val = el.attrib.get(attr, "").strip()
            if val and not any(skip in val.lower() for skip in skip_words):
                images.add(val)

        # srcset
        for attr in ["srcset", "data-srcset"]:
            val = el.attrib.get(attr, "")
            if val:
                for part in val.split(","):
                    url_part = part.strip().split()[0]
                    if url_part and not any(skip in url_part.lower() for skip in skip_words):
                        images.add(url_part)

    # <picture> <source> elements
    for el in page.css("source"):
        srcset = el.attrib.get("srcset", "")
        if srcset:
            for part in srcset.split(","):
                url_part = part.strip().split()[0]
                if url_part and not any(skip in url_part.lower() for skip in skip_words):
                    images.add(url_part)

    # JSON-LD images
    if result["json_ld"]:
        def extract_images_from_jld(obj):
            if isinstance(obj, str) and re.search(r'\.(jpg|jpeg|png|webp)', obj, re.I):
                images.add(obj)
            elif isinstance(obj, list):
                for item in obj:
                    extract_images_from_jld(item)
            elif isinstance(obj, dict):
                for key in ["image", "images", "thumbnailUrl", "contentUrl"]:
                    if key in obj:
                        extract_images_from_jld(obj[key])
                if "@graph" in obj:
                    extract_images_from_jld(obj["@graph"])
        extract_images_from_jld(result["json_ld"])

    # OG image
    if result["og_image"]:
        images.add(result["og_image"])

    # CSS background images
    bg_matches = re.findall(r'background(?:-image)?\s*:\s*url\([\'"]?([^\'")\s]+)[\'"]?\)', html)
    for url_match in bg_matches:
        if not any(skip in url_match.lower() for skip in skip_words):
            images.add(url_match)

    result["product_images"] = list(images)

    # ── Body text ──
    # Remove scripts, styles, nav, footer
    body_text = ""
    for el in page.css("h1, h2, h3, h4, p, li, span, td"):
        text = el.text
        if text:
            text = text.strip()
            if len(text) > 10:
                body_text += text + "\n"
        if len(body_text) > 4000:
            break
    result["body_text"] = body_text[:4000]

    # ── Colors from CSS ──
    color_matches = re.findall(r'(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))', html)
    seen = set()
    colors = []
    for c in color_matches:
        if c not in seen and len(colors) < 10:
            seen.add(c)
            colors.append(c)
    result["colors"] = colors

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No URL provided"}))
        sys.exit(1)

    url = sys.argv[1]
    data = scrape_url(url)
    print(json.dumps(data, ensure_ascii=False))
