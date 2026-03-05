import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { assemblePrompt, assembleAllPrompts, assembleCarouselSlides, refinePromptWithAI, getNicheKeys, normalizePlatform } from './prompt-engine.js';
import { scrapeAndAnalyze } from './business-scraper.js';
import { generateAllCategoryPrompts } from './prompt-generator.js';
import { resolveSubniche } from './subniche-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── Load all prompt JSON files ──────────────────────────────────────────
const CATEGORIES = [
    'ads', 'social_posts', 'product_photo', 'branding', 'memes',
    'educational', 'event', 'testimonial', 'stories', 'email', 'thumbnails',
];

const promptConfigs = {};
for (const cat of CATEGORIES) {
    const filePath = join(__dirname, 'prompts', `prompts_${cat}.json`);
    try {
        promptConfigs[cat] = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (err) {
        console.warn(`[warn] Could not load prompts_${cat}.json: ${err.message}`);
    }
}

console.log(`[prompt-tester] Loaded ${Object.keys(promptConfigs).length} prompt categories`);

// ── GET /api/prompts ────────────────────────────────────────────────────
app.get('/api/prompts', (_req, res) => {
    const summary = {};
    for (const [cat, cfg] of Object.entries(promptConfigs)) {
        summary[cat] = {
            schema_version: cfg.schema_version,
            niches: Object.keys(cfg.niches || {}),
            platforms: Object.keys(cfg.platforms || {}),
            globals: cfg.globals,
        };
    }
    res.json(summary);
});

// ── GET /api/prompts/:category ──────────────────────────────────────────
app.get('/api/prompts/:category', (req, res) => {
    const cfg = promptConfigs[req.params.category];
    if (!cfg) return res.status(404).json({ error: 'Category not found' });
    res.json(cfg);
});

// ── POST /api/assemble ──────────────────────────────────────────────────
app.post('/api/assemble', async (req, res) => {
    try {
        const { categories, niche, platform, contentType, title, description, image, businessContext, carouselSlideCount } = req.body;

        if (!categories?.length) {
            return res.status(400).json({ error: 'At least one category is required' });
        }

        if (businessContext) {
            console.log(`[assemble] Business mode: "${businessContext.name}" (${businessContext.industry})`);
        }

        const results = [];

        for (const category of categories) {
            const config = promptConfigs[category];
            if (!config) {
                results.push({ category, error: `Unknown category: ${category}` });
                continue;
            }

            let resolvedNiche = niche;
            if (!resolvedNiche) {
                if (businessContext) {
                    // Business mode: detect specific subniche via AI
                    // Auto-generates new niche entry if it doesn't exist
                    resolvedNiche = await resolveSubniche(businessContext, promptConfigs, category);
                    businessContext.resolvedNiche = resolvedNiche;
                    console.log(`[assemble] Subniche resolved: "${resolvedNiche}" for "${businessContext.name}"`);
                } else {
                    resolvedNiche = await classifyNicheViaAI(title, description, getNicheKeys(config), image);
                }
            }

            if (!config.niches?.[resolvedNiche]) {
                resolvedNiche = 'general';
            }

            let prompt = assemblePrompt(config, resolvedNiche, platform, contentType, title, description, category, businessContext);
            let allPrompts = assembleAllPrompts(config, resolvedNiche, platform, contentType, title, description, category, businessContext);

            // For carousel content type, also generate per-slide prompts
            let carouselData = null;
            if (contentType === 'carousel') {
                const slideCount = Math.min(Math.max(carouselSlideCount || 5, 3), 10);
                carouselData = assembleCarouselSlides(config, resolvedNiche, platform, slideCount, title, description, category, businessContext);
            }

            // ── AI Creative Strategist (business mode only) ──────────
            // Send each prompt to Gemini with Google Search to research
            // current trends and generate optimized, winning prompts
            if (businessContext) {
                // Inject platform so strategist can research platform-specific trends
                businessContext.platform = normalizePlatform(platform);
                console.log(`[strategist] 🔍 Researching trends & optimizing ${allPrompts.length} prompts for "${businessContext.name}" on ${platform}...`);

                // Optimize main prompt + all variants in parallel
                const refinePromises = [
                    refinePromptWithAI(prompt, businessContext),
                    ...allPrompts.map(v =>
                        refinePromptWithAI(v.prompt, businessContext).then(refined => ({ ...v, prompt: refined }))
                    ),
                ];

                // Optimize carousel slides too if present
                if (carouselData?.slides?.length) {
                    const carouselRefinePromises = carouselData.slides.map(slide =>
                        refinePromptWithAI(slide.prompt, businessContext).then(refined => ({ ...slide, prompt: refined }))
                    );
                    const [refinedMain, ...refinedVariants] = await Promise.all(refinePromises);
                    const refinedCarouselSlides = await Promise.all(carouselRefinePromises);

                    prompt = refinedMain;
                    allPrompts = refinedVariants;
                    carouselData = { ...carouselData, slides: refinedCarouselSlides };
                } else {
                    const [refinedMain, ...refinedVariants] = await Promise.all(refinePromises);
                    prompt = refinedMain;
                    allPrompts = refinedVariants;
                }

                console.log(`[strategist] ✅ AI trend research & optimization complete for "${businessContext.name}"`);
            }

            results.push({
                category,
                niche: resolvedNiche,
                platform: normalizePlatform(platform),
                contentType,
                prompt,
                allPrompts,
                ...(carouselData && { carouselModel: carouselData.model, carouselSlides: carouselData.slides }),
            });
        }

        res.json({ results });
    } catch (err) {
        console.error('[assemble] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/scrape-business ───────────────────────────────────────────
// Scrapes a website and returns a structured business profile.
app.post('/api/scrape-business', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'url is required' });
        console.log(`[scrape-business] Analyzing: ${url}`);
        const profile = await scrapeAndAnalyze(url);
        res.json({ businessProfile: profile });
    } catch (err) {
        console.error('[scrape-business] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/generate-prompts ──────────────────────────────────────────
// Generates AI-powered prompts for a business across selected categories.
app.post('/api/generate-prompts', async (req, res) => {
    try {
        const { businessProfile, categories, platform, contentType } = req.body;
        if (!businessProfile) return res.status(400).json({ error: 'businessProfile is required' });
        if (!categories?.length) return res.status(400).json({ error: 'categories are required' });
        console.log(`[generate-prompts] Generating for "${businessProfile.name}" — ${categories.join(', ')}`);
        const results = await generateAllCategoryPrompts(businessProfile, categories, platform || 'instagram', contentType || 'image');
        res.json({ results });
    } catch (err) {
        console.error('[generate-prompts] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/generate ──────────────────────────────────────────────────
// Sends a prompt to an AI provider for IMAGE or VIDEO generation.
// Body: { prompt, provider ('gemini'|'openai'), model, contentType ('image'|'video'), referenceImage?, referenceImages? }
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, provider, model, contentType, referenceImage, referenceImages, platform } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });
        // Normalize: use referenceImages array if present, otherwise wrap single
        const refImages = referenceImages || (referenceImage ? [referenceImage] : []);
        // Map platform to image size for OpenAI
        const sizeMap = {
            tiktok: '1024x1536',      // 2:3 portrait (closest to 9:16)
            instagram: '1024x1536',   // 4:5 portrait
            facebook: '1024x1536',    // 4:5 portrait
            pinterest: '1024x1536',   // 2:3 tall pin
            youtube: '1536x1024',     // 16:9 landscape
            x: '1536x1024',           // 16:9 landscape
        };
        const imageSize = sizeMap[platform] || '1024x1024';

        let result;
        const isVideo = contentType === 'video';

        if (provider === 'openai') {
            if (isVideo) {
                result = await generateVideoOpenAI(prompt, model, refImages[0] || null);
            } else {
                result = await generateImageOpenAI(prompt, model, refImages, imageSize);
            }
        } else {
            if (isVideo) {
                result = await generateVideoGemini(prompt, model, refImages[0] || null);
            } else {
                result = await generateImageGemini(prompt, model, refImages);
            }
        }

        res.json({ provider, model, ...result });
    } catch (err) {
        console.error('[generate] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════
// AI Integration — Image & Video Generation
// ═══════════════════════════════════════════════════════════════════════

// ── Helper: Extract detailed product description from image via Gemini ──
async function describeProductFromImage(imageDataUri) {
    if (!imageDataUri) return null;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const match = imageDataUri.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (!match) return null;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: match[1],
                            data: match[2],
                        },
                    },
                    {
                        text: `You are a product photography expert. Describe this product in EXTREME detail so another AI can recreate it with 100% visual fidelity. Include:
- Exact shape, proportions, and dimensions (relative)
- Exact colors (use specific color names like "matte midnight navy" not just "blue")
- All text, logos, labels, and branding visible on the product (exact text, font style, placement)
- Material and texture (glossy, matte, metallic, transparent, fabric weave, etc.)
- Any patterns, gradients, or decorative elements
- Packaging details (box, bottle, tube, jar, pouch — exact shape)
- Cap/lid/closure style if applicable
- Any unique distinguishing features

Be extremely specific and visual. Output ONLY the description, no preamble.`,
                    },
                ],
            }],
        });

        const desc = (response.text || '').trim();
        console.log('[describeProduct] Extracted description:', desc.substring(0, 200) + '...');
        return desc || null;
    } catch (err) {
        console.warn('[describeProduct] Failed:', err.message);
        return null;
    }
}

/** Build a prompt prefix that forces the AI to include the exact product */
function buildProductInjection(productDescription) {
    if (!productDescription) return '';
    return `\n\nMANDATORY PRODUCT REQUIREMENT — THIS IS THE MOST IMPORTANT INSTRUCTION:
The generated image MUST prominently feature the following EXACT product. Do NOT invent, alter, or substitute the product. Reproduce it with 100% visual fidelity:

${productDescription}

The product must be clearly visible, in-focus, and the central subject of the image. Every detail (colors, text, logos, shape, materials) must match the description above exactly.\n\n`;
}

async function classifyNicheViaAI(title, description, nicheKeys, imageDataUri) {
    const metaPrompt = `Classify this product into exactly ONE niche. Output ONLY the niche key, nothing else.

Product: ${title} - ${description}

Available niches: ${nicheKeys.join(', ')}`;

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) return 'general';
        const ai = new GoogleGenAI({ apiKey });

        // Build content parts — include image if provided for vision analysis
        const parts = [];

        if (imageDataUri) {
            // Extract base64 and mimeType from data URI: data:image/jpeg;base64,/9j/4A...
            const match = imageDataUri.match(/^data:(image\/[^;]+);base64,(.+)$/);
            if (match) {
                parts.push({
                    inlineData: {
                        mimeType: match[1],
                        data: match[2],
                    },
                });
                parts.push({ text: `Look at this product image carefully. ${metaPrompt}` });
            } else {
                parts.push({ text: metaPrompt });
            }
        } else {
            parts.push({ text: metaPrompt });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts }],
        });
        const cleaned = (response.text || '').trim().toLowerCase().replace(/[^a-z_]/g, '');
        return nicheKeys.includes(cleaned) ? cleaned : 'general';
    } catch (err) {
        console.warn('[classifyNiche] Failed:', err.message);
        return 'general';
    }
}

// ── Gemini Image Generation ─────────────────────────────────────────────
async function generateImageGemini(prompt, model, referenceImages) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY not set');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const selectedModel = model || 'imagen-4.0-generate-001';
    // Normalize referenceImages
    const refImages = Array.isArray(referenceImages) ? referenceImages : (referenceImages ? [referenceImages] : []);

    // Native Gemini image gen models (gemini-*) use generateContent
    // These support multimodal input — pass product images directly
    if (selectedModel.startsWith('gemini-')) {
        const parts = [];

        // Pass all reference images as inline data
        if (refImages.length > 0) {
            refImages.forEach((img, idx) => {
                const match = img.match(/^data:(image\/[^;]+);base64,(.+)$/);
                if (match) {
                    parts.push({
                        inlineData: {
                            mimeType: match[1],
                            data: match[2],
                        },
                    });
                }
            });
            const multiRef = refImages.length > 1
                ? `CRITICAL INSTRUCTION: The ${refImages.length} images above are reference images. You MUST use ALL of them as visual references to create a cohesive final image. Reproduce each product/element with 100% visual fidelity — same colors, shapes, logos, text, materials. Combine them naturally.\n\n${prompt}`
                : `CRITICAL INSTRUCTION: The image above is the EXACT product that MUST appear in the generated image. You MUST reproduce this product with 100% visual fidelity — same colors, shape, logos, text, materials, and proportions. The product must be the central, clearly visible subject. Do NOT invent or substitute a different product.\n\n${prompt}`;
            parts.push({ text: multiRef });
        } else {
            parts.push({ text: prompt });
        }

        const response = await ai.models.generateContent({
            model: selectedModel,
            contents: [{ role: 'user', parts }],
            config: { responseModalities: ['TEXT', 'IMAGE'] },
        });

        console.log('[generateImageGemini] RAW RESPONSE:', JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));

        // Extract image from response
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData?.data) {
                    return {
                        type: 'image',
                        mimeType: part.inlineData.mimeType || 'image/png',
                        data: part.inlineData.data, // base64
                    };
                }
            }
        }
        throw new Error('No image returned from Gemini native model');
    }

    // Imagen models use generateImages (text-only)
    // For these, extract a detailed product description and inject into prompt
    let enrichedPrompt = prompt;
    if (referenceImage) {
        const productDesc = await describeProductFromImage(referenceImage);
        enrichedPrompt = buildProductInjection(productDesc) + prompt;
        console.log('[generateImageGemini] Enriched prompt with product description for Imagen');
    }

    const response = await ai.models.generateImages({
        model: selectedModel,
        prompt: enrichedPrompt,
        config: { numberOfImages: 1 },
    });

    if (response.generatedImages?.[0]?.image?.imageBytes) {
        const bytes = response.generatedImages[0].image.imageBytes;
        // Convert Uint8Array to base64
        const b64 = Buffer.from(bytes).toString('base64');
        return {
            type: 'image',
            mimeType: 'image/png',
            data: b64,
        };
    }

    throw new Error('No image returned from Imagen');
}

// ── Gemini Video Generation ─────────────────────────────────────────────
async function generateVideoGemini(prompt, model, referenceImage) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY not set');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const selectedModel = model || 'veo-3.1-generate-preview';

    // Veo is text-only — extract product description and inject into prompt
    let enrichedPrompt = prompt;
    if (referenceImage) {
        const productDesc = await describeProductFromImage(referenceImage);
        enrichedPrompt = buildProductInjection(productDesc) + prompt;
        console.log('[generateVideoGemini] Enriched prompt with product description for Veo');
    }

    let operation = await ai.models.generateVideos({
        model: selectedModel,
        prompt: enrichedPrompt,
        config: { numberOfVideos: 1, durationSeconds: 8 },
    });

    // Poll until done
    while (!operation.done) {
        await new Promise(r => setTimeout(r, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
    }

    if (operation.error) {
        throw new Error(`Video generation failed: ${JSON.stringify(operation.error)}`);
    }

    const videos = operation.response?.generatedVideos;
    if (videos?.length > 0 && videos[0].video) {
        const videoBytes = await ai.files.download({ file: videos[0].video });
        const b64 = Buffer.from(videoBytes).toString('base64');
        return {
            type: 'video',
            mimeType: 'video/mp4',
            data: b64,
        };
    }

    throw new Error('No video returned from Veo');
}

// ── OpenAI Image Generation ─────────────────────────────────────────────
async function generateImageOpenAI(prompt, model, referenceImages, imageSize = '1024x1024') {
    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY not set');

    const selectedModel = model || 'gpt-image-1';
    // Normalize referenceImages
    const refImages = Array.isArray(referenceImages) ? referenceImages : (referenceImages ? [referenceImages] : []);

    // gpt-image-1.5 / gpt-image-1 / gpt-image-1-mini support image input
    if (selectedModel !== 'dall-e-3' && refImages.length > 0) {
        console.log(`[generateImageOpenAI] ${refImages.length} ref image(s) with model ${selectedModel}`);

        // Build content parts: images first, then text prompt
        // Responses API types: input_image, input_text, input_file
        const contentParts = [];
        refImages.forEach((img, idx) => {
            const match = img.match(/^data:(image\/[^;]+);base64,(.+)$/);
            if (match) {
                contentParts.push({
                    type: 'input_image',
                    image_url: img,
                });
                console.log(`[generateImageOpenAI] Added ref image ${idx + 1}/${refImages.length} (${match[1]})`);
            }
        });

        const instructionText = refImages.length > 1
            ? `CRITICAL: I have provided ${refImages.length} reference images above. You MUST use ALL ${refImages.length} images as visual references. Each image contains a product/element that MUST appear in the final generated image with 100% visual fidelity — preserve exact colors, shapes, logos, text, materials, and proportions from EVERY reference image. Combine all elements naturally into one cohesive composition.\n\n${prompt}`
            : `CRITICAL: The uploaded image shows the EXACT product that MUST appear in the generated image with 100% fidelity. Keep the product identical — same colors, shape, logos, text, materials. Place it prominently as the central subject.\n\n${prompt}`;
        contentParts.push({ type: 'input_text', text: instructionText });

        console.log(`[generateImageOpenAI] Sending ${contentParts.length} content parts (${contentParts.filter(p => p.type === 'input_image').length} images + text)`);

        // Image-specific models (gpt-image-*) must be accessed through a chat model
        // via the Responses API with image_generation tool
        const chatModel = 'gpt-4o';
        console.log(`[generateImageOpenAI] Using chat model '${chatModel}' with image_generation tool (requested: ${selectedModel})`);

        // Use the Responses API for multi-modal image generation
        const resp = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: chatModel,
                input: [{
                    role: 'user',
                    content: contentParts,
                }],
                tools: [{ type: 'image_generation', quality: 'high', size: imageSize }],
            }),
        });

        if (!resp.ok) {
            const body = await resp.text();
            console.error(`[generateImageOpenAI] Responses API error ${resp.status}:`, body);
            // Fallback to edits API with single image
            if (refImages[0]) {
                return await generateImageOpenAIEdits(prompt, selectedModel, refImages[0], apiKey);
            }
            throw new Error(`OpenAI Responses API error ${resp.status}: ${body}`);
        }

        const data = await resp.json();
        console.log('[generateImageOpenAI] Response output types:', data.output?.map(o => o.type));
        // Extract generated image from response output
        if (data.output) {
            for (const item of data.output) {
                if (item.type === 'image_generation_call' && item.result) {
                    return {
                        type: 'image',
                        mimeType: 'image/png',
                        data: item.result,
                    };
                }
            }
        }
        throw new Error('No image returned from OpenAI Responses API');
    }

    // DALL-E 3 or fallback: text-only generation with product description injected
    let enrichedPrompt = prompt;
    if (refImages.length > 0) {
        const productDesc = await describeProductFromImage(refImages[0]);
        enrichedPrompt = buildProductInjection(productDesc) + prompt;
        console.log('[generateImageOpenAI] Enriched prompt with product description for DALL-E 3');
    }

    const payload = {
        model: selectedModel,
        prompt: enrichedPrompt,
        n: 1,
        size: imageSize,
    };

    // DALL-E 3 uses response_format, gpt-image-1 uses output_format
    if (selectedModel === 'dall-e-3') {
        payload.quality = 'hd';
        payload.response_format = 'b64_json';
    } else {
        payload.quality = 'high';
        payload.output_format = 'png';
    }

    const resp = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`OpenAI Image API error ${resp.status}: ${body}`);
    }

    const data = await resp.json();
    if (data.data?.[0]?.b64_json) {
        return {
            type: 'image',
            mimeType: 'image/png',
            data: data.data[0].b64_json,
        };
    }

    throw new Error('No image returned from OpenAI');
}

// Fallback: single-image edit via legacy edits API
async function generateImageOpenAIEdits(prompt, model, referenceImage, apiKey) {
    const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid reference image format');
    console.log('[generateImageOpenAIEdits] Fallback to edits API');
    const imageBuffer = Buffer.from(match[2], 'base64');
    const formData = new globalThis.FormData();
    const blob = new globalThis.Blob([imageBuffer], { type: match[1] });
    formData.append('image', blob, 'product.png');
    formData.append('prompt', `CRITICAL: The uploaded image shows the EXACT product. Keep it identical.\n\n${prompt}`);
    formData.append('model', model);
    formData.append('n', '1');
    formData.append('size', '1024x1024');
    formData.append('quality', 'high');
    const resp = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
    });
    if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`OpenAI Edits API fallback error ${resp.status}: ${body}`);
    }
    const data = await resp.json();
    if (data.data?.[0]?.b64_json) return { type: 'image', mimeType: 'image/png', data: data.data[0].b64_json };
    if (data.data?.[0]?.url) {
        const imgResp = await fetch(data.data[0].url);
        return { type: 'image', mimeType: 'image/png', data: Buffer.from(await imgResp.arrayBuffer()).toString('base64') };
    }
    throw new Error('No image from OpenAI edits fallback');
}

// ── OpenAI Video Generation (Sora) ──────────────────────────────────────
async function generateVideoOpenAI(prompt, model, referenceImage) {
    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY not set');

    const selectedModel = model || 'sora-2';

    // Sora is text-only — extract product description and inject into prompt
    let enrichedPrompt = prompt;
    if (referenceImage) {
        const productDesc = await describeProductFromImage(referenceImage);
        enrichedPrompt = buildProductInjection(productDesc) + prompt;
        console.log('[generateVideoOpenAI] Enriched prompt with product description for Sora');
    }

    // Start video job
    const startResp = await fetch('https://api.openai.com/v1/videos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: selectedModel,
            prompt: enrichedPrompt,
            size: '1920x1080',
            seconds: 10,
        }),
    });

    if (!startResp.ok) {
        const body = await startResp.text();
        throw new Error(`OpenAI Video API error ${startResp.status}: ${body}`);
    }

    const job = await startResp.json();
    let jobStatus = job;

    // Poll until complete
    while (jobStatus.status !== 'completed' && jobStatus.status !== 'failed' && jobStatus.status !== 'canceled') {
        await new Promise(r => setTimeout(r, 10000));

        const pollResp = await fetch(`https://api.openai.com/v1/videos/${job.id}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        jobStatus = await pollResp.json();
    }

    if (jobStatus.status === 'failed') {
        throw new Error(`Video generation failed: ${jobStatus.error?.message || 'Unknown error'}`);
    }

    if (jobStatus.status === 'completed') {
        // Download video
        const videoResp = await fetch(`https://api.openai.com/v1/videos/${job.id}/content`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        const arrayBuf = await videoResp.arrayBuffer();
        const b64 = Buffer.from(arrayBuf).toString('base64');
        return {
            type: 'video',
            mimeType: 'video/mp4',
            data: b64,
        };
    }

    throw new Error('Video generation was canceled');
}

// ── Start ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[prompt-tester] Server running on http://localhost:${PORT}`);
    console.log(`[prompt-tester] Gemini key: ${process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? '✓' : '✗'}`);
    console.log(`[prompt-tester] OpenAI key: ${process.env.OPENAI_KEY ? '✓' : '✗'}`);
});
