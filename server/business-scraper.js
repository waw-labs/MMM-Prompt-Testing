/**
 * business-scraper.js
 * AI-powered website scraper and business analyzer.
 * Detects page type (landing/homepage vs product page) and extracts
 * either a business profile or product details with images.
 */

/**
 * Fetches and extracts text content + images from a website URL.
 */
async function fetchWebsiteContent(url) {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;

    console.log(`[scraper] Fetching: ${normalizedUrl}`);

    const resp = await fetch(normalizedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) throw new Error(`Failed to fetch ${normalizedUrl}: ${resp.status}`);

    const html = await resp.text();

    // ── Meta extraction ──
    const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() || '';
    const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is)?.[1]?.trim() || '';
    const metaKeywords = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["'](.*?)["']/is)?.[1]?.trim() || '';
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/is)?.[1]?.trim() || '';
    const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/is)?.[1]?.trim() || '';
    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["']/is)?.[1]?.trim() || '';
    const ogType = html.match(/<meta[^>]*property=["']og:type["'][^>]*content=["'](.*?)["']/is)?.[1]?.trim() || '';

    // ── Structured data (JSON-LD) ──
    let jsonLd = null;
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
        try { jsonLd = JSON.parse(jsonLdMatch[1]); } catch { }
    }

    // ── Product price detection ──
    const priceMatch = html.match(/["']price["']\s*:\s*["']?([\d.,]+)["']?/i)
        || html.match(/\$\s*([\d.,]+)/);
    const productPrice = priceMatch?.[1] || '';

    // ── Body text extraction ──
    let bodyText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n## $1\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#?\w+;/g, '').replace(/\s+/g, ' ').trim();

    if (bodyText.length > 4000) bodyText = bodyText.substring(0, 4000) + '...';

    // ── Colors from CSS ──
    const colors = [];
    const colorMatches = html.matchAll(/(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|hsl\([^)]+\))/g);
    for (const m of colorMatches) {
        if (!colors.includes(m[1]) && colors.length < 10) colors.push(m[1]);
    }

    // ── Logo candidates ──
    const logoCandidates = [];
    const appleTouchIcon = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["'](.*?)["']/is)?.[1];
    if (appleTouchIcon) logoCandidates.push(appleTouchIcon);
    const logoImgs = html.matchAll(/<img[^>]*(?:class|id|alt)[^>]*(?:logo|brand)[^>]*src=["'](.*?)["']/gi);
    for (const m of logoImgs) logoCandidates.push(m[1]);
    const logoImgs2 = html.matchAll(/<img[^>]*src=["'](.*?)["'][^>]*(?:class|id|alt)[^>]*(?:logo|brand)/gi);
    for (const m of logoImgs2) logoCandidates.push(m[1]);
    const favicon = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["'](.*?)["']/is)?.[1];
    if (favicon) logoCandidates.push(favicon);

    // ── Product images (all substantial images from the page) ──
    const allImageUrls = [];
    const imgMatches = html.matchAll(/<img[^>]*src=["'](.*?)["'][^>]*/gi);
    for (const m of imgMatches) allImageUrls.push(m[1]);
    // Also srcset images
    const srcsetMatches = html.matchAll(/srcset=["']([^"']+)["']/gi);
    for (const m of srcsetMatches) {
        const urls = m[1].split(',').map(s => s.trim().split(/\s+/)[0]);
        allImageUrls.push(...urls);
    }

    // Resolve and deduplicate URLs
    const baseUrl = new URL(normalizedUrl);
    const resolveUrl = (u) => { try { return new URL(u, baseUrl).href; } catch { return null; } };

    const resolvedLogos = [...new Set(logoCandidates.map(resolveUrl).filter(Boolean))];
    const resolvedImages = [...new Set(allImageUrls.map(resolveUrl).filter(Boolean))];

    // Filter product images: exclude tiny icons, logos, tracking pixels, SVGs
    const productImages = resolvedImages.filter(url => {
        const lower = url.toLowerCase();
        // Skip icons, logos, tracking, SVGs, tiny files
        if (lower.includes('logo')) return false;
        if (lower.includes('icon')) return false;
        if (lower.includes('favicon')) return false;
        if (lower.includes('pixel')) return false;
        if (lower.includes('tracking')) return false;
        if (lower.includes('badge')) return false;
        if (lower.includes('payment')) return false;
        if (lower.includes('sprite')) return false;
        if (lower.endsWith('.svg')) return false;
        if (lower.endsWith('.gif') && !lower.includes('product')) return false;
        // Keep only substantial image URLs
        return true;
    });

    console.log(`[scraper] Found ${resolvedLogos.length} logos, ${productImages.length} product image candidates`);

    return {
        url: normalizedUrl,
        html, // keep raw HTML for page type detection
        title, metaDescription: metaDesc, metaKeywords,
        ogTitle, ogDescription: ogDesc, ogImage, ogType,
        jsonLd, productPrice, bodyText, colors,
        logoCandidates: resolvedLogos,
        productImages,
    };
}

/**
 * Downloads an image URL and converts it to a base64 data URI.
 * @param {string} label - label for logging (e.g. "logo", "product")
 * @param {number} minBytes - minimum size in bytes to accept
 */
async function downloadImageAsBase64(imageUrl, label = 'image', minBytes = 1024) {
    try {
        const resp = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MMMScraper/1.0)' },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) return null;

        const contentType = resp.headers.get('content-type') || 'image/png';
        if (!contentType.startsWith('image/')) return null;

        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength < minBytes) return null;

        const mimeType = contentType.split(';')[0].trim();
        const base64 = Buffer.from(buffer).toString('base64');
        console.log(`[scraper] Downloaded ${label}: ${mimeType}, ${Math.round(buffer.byteLength / 1024)}KB`);
        return `data:${mimeType};base64,${base64}`;
    } catch (err) {
        return null;
    }
}

/**
 * Uses AI to classify the page type and extract structured data.
 */
async function analyzePageWithAI(scrapedData) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a senior marketing strategist. Analyze this webpage and determine what it is.

WEBPAGE DATA:
- URL: ${scrapedData.url}
- Page Title: ${scrapedData.title}
- Meta Description: ${scrapedData.metaDescription}
- OG Type: ${scrapedData.ogType || 'N/A'}
- OG Title: ${scrapedData.ogTitle}
- OG Description: ${scrapedData.ogDescription}
- Product Price Found: ${scrapedData.productPrice || 'none'}
- JSON-LD Type: ${scrapedData.jsonLd?.['@type'] || 'none'}
- Brand Colors: ${scrapedData.colors.join(', ') || 'none'}
- Number of Product Images: ${scrapedData.productImages.length}

WEBPAGE CONTENT:
${scrapedData.bodyText}

===

STEP 1: Classify this page as one of:
- "product" — A specific product page (e.g. an e-commerce product listing, a single item page with add-to-cart, price, product photos)
- "business" — A landing page, homepage, SaaS page, app page, or general business/brand page

STEP 2: Extract information based on the type.

Return a JSON object with these fields:

{
  "pageType": "product" or "business",
  "name": "Business name OR Product name",
  "industry": "Primary industry (health_wellness, tech_gadgets, beauty_skincare, fitness, fashion_apparel, food_beverage, education_learning, home_organization, pets, automotive, supplements, baby_kids, saas, fintech, ecommerce, real_estate, etc.)",
  "subIndustry": "More specific sub-category",
  "products": ["List of products/services (for business) or just the product name (for product page)"],
  "usp": "Unique selling proposition in 1-2 sentences",
  "targetAudience": "Who they sell to",
  "brandTone": "professional, playful, luxury, bold, minimal, friendly",
  "brandColors": ["Primary hex colors of the brand"],
  "priceRange": "budget/mid-range/premium/luxury",
  "painPoints": ["Customer pain points they solve"],
  "emotionalTriggers": ["Emotional hooks"],
  "summary": "2-3 sentence description",
  "productTitle": "Product name (if product page, else empty string)",
  "productDescription": "Detailed product description for ads (if product page, else empty string)",
  "productPrice": "Current/sale price as number only e.g. '29.99' (if found, else empty string)",
  "originalPrice": "Original price before discount as number only e.g. '49.99' (if found, else empty string)",
  "discount": "Discount percentage e.g. '40%' (if sale detected, else empty string)",
  "productColors": ["Available color variants of the product if found, else empty array"]
}

Return ONLY valid JSON. No markdown wrapping.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[scraper] AI analysis raw:', text.substring(0, 200));

    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    try {
        const result = JSON.parse(jsonStr);
        return {
            ...result,
            url: scrapedData.url,
            ogImage: scrapedData.ogImage,
            scrapedAt: new Date().toISOString(),
        };
    } catch (err) {
        console.error('[scraper] Failed to parse AI response:', err.message);
        return {
            pageType: 'business',
            name: scrapedData.ogTitle || scrapedData.title || 'Unknown',
            industry: 'general',
            products: [],
            usp: scrapedData.metaDescription || '',
            targetAudience: 'General consumers',
            brandTone: 'professional',
            brandColors: scrapedData.colors,
            summary: scrapedData.metaDescription || 'Website',
            url: scrapedData.url,
            ogImage: scrapedData.ogImage,
            scrapedAt: new Date().toISOString(),
            _parseError: true,
        };
    }
}

/**
 * Main entrypoint: scrape a website, detect type, and return structured data.
 * Returns { pageType, ...profile/product data, logoBase64?, productImagesBase64? }
 */
export async function scrapeAndAnalyze(url) {
    const scrapedData = await fetchWebsiteContent(url);
    const profile = await analyzePageWithAI(scrapedData);

    // Download logo
    let logoBase64 = null;
    for (const logoUrl of (scrapedData.logoCandidates || [])) {
        logoBase64 = await downloadImageAsBase64(logoUrl, 'logo', 1024);
        if (logoBase64) break;
    }
    profile.logoBase64 = logoBase64;
    profile.logoUrl = scrapedData.logoCandidates?.[0] || null;

    // For product pages: download the best product images
    if (profile.pageType === 'product') {
        console.log(`[scraper] Product page detected — downloading up to 5 product images...`);
        const productImagesBase64 = [];

        // Priority: OG image first (usually the hero product shot)
        if (scrapedData.ogImage) {
            const ogB64 = await downloadImageAsBase64(scrapedData.ogImage, 'product-og', 5000);
            if (ogB64) productImagesBase64.push(ogB64);
        }

        // Then download remaining product images (skip tiny ones, max 5 total)
        for (const imgUrl of scrapedData.productImages) {
            if (productImagesBase64.length >= 5) break;
            // Skip if already downloaded as OG image
            if (imgUrl === scrapedData.ogImage) continue;
            const b64 = await downloadImageAsBase64(imgUrl, 'product', 10000); // min 10KB for product images
            if (b64) productImagesBase64.push(b64);
        }

        profile.productImagesBase64 = productImagesBase64;
        console.log(`[scraper] Downloaded ${productImagesBase64.length} product images`);
    }

    const typeLabel = profile.pageType === 'product' ? '🛍️ Product' : '🏢 Business';
    console.log(`[scraper] ${typeLabel} — "${profile.name}" (${profile.industry}) — logo: ${logoBase64 ? '✓' : '✗'}`);
    return profile;
}
