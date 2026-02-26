import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { assemblePrompt, assembleAllPrompts, getNicheKeys, normalizePlatform } from './prompt-engine.js';

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
        const { categories, niche, platform, contentType, title, description, image } = req.body;

        if (!categories?.length) {
            return res.status(400).json({ error: 'At least one category is required' });
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
                resolvedNiche = await classifyNicheViaAI(title, description, getNicheKeys(config), image);
            }

            if (!config.niches?.[resolvedNiche]) {
                resolvedNiche = 'general';
            }

            const prompt = assemblePrompt(config, resolvedNiche, platform, contentType, title, description, category);
            const allPrompts = assembleAllPrompts(config, resolvedNiche, platform, contentType, title, description, category);

            results.push({
                category,
                niche: resolvedNiche,
                platform: normalizePlatform(platform),
                contentType,
                prompt,
                allPrompts,
            });
        }

        res.json({ results });
    } catch (err) {
        console.error('[assemble] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/generate ──────────────────────────────────────────────────
// Sends a prompt to an AI provider for IMAGE or VIDEO generation.
// Body: { prompt, provider ('gemini'|'openai'), model, contentType ('image'|'video'), referenceImage? }
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, provider, model, contentType, referenceImage } = req.body;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });

        let result;
        const isVideo = contentType === 'video';

        if (provider === 'openai') {
            if (isVideo) {
                result = await generateVideoOpenAI(prompt, model, referenceImage);
            } else {
                result = await generateImageOpenAI(prompt, model, referenceImage);
            }
        } else {
            if (isVideo) {
                result = await generateVideoGemini(prompt, model, referenceImage);
            } else {
                result = await generateImageGemini(prompt, model, referenceImage);
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
async function generateImageGemini(prompt, model, referenceImage) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY not set');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const selectedModel = model || 'imagen-4.0-generate-001';

    // Native Gemini image gen models (gemini-2.5-flash-image) use generateContent
    // These support multimodal input — pass the product image directly
    if (selectedModel.startsWith('gemini-')) {
        const parts = [];

        // If we have a reference product image, pass it directly to the model
        if (referenceImage) {
            const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/);
            if (match) {
                parts.push({
                    inlineData: {
                        mimeType: match[1],
                        data: match[2],
                    },
                });
                parts.push({
                    text: `CRITICAL INSTRUCTION: The image above is the EXACT product that MUST appear in the generated image. You MUST reproduce this product with 100% visual fidelity — same colors, shape, logos, text, materials, and proportions. The product must be the central, clearly visible subject. Do NOT invent or substitute a different product.\n\n${prompt}`,
                });
            } else {
                parts.push({ text: prompt });
            }
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
async function generateImageOpenAI(prompt, model, referenceImage) {
    const apiKey = process.env.OPENAI_KEY;
    if (!apiKey) throw new Error('OPENAI_KEY not set');

    const selectedModel = model || 'gpt-image-1';

    // gpt-image-1 supports image input via the images/edits endpoint
    if (selectedModel !== 'dall-e-3' && referenceImage) {
        const match = referenceImage.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (match) {
            console.log('[generateImageOpenAI] Using edits API with product reference image');

            // Convert base64 to a Blob for multipart upload
            const imageBuffer = Buffer.from(match[2], 'base64');
            const ext = match[1].includes('png') ? 'png' : 'png';

            // Use FormData for multipart upload
            const { FormData, Blob } = await import('node-fetch');
            // Node 18+ has global FormData and Blob
            const formData = new globalThis.FormData();
            const blob = new globalThis.Blob([imageBuffer], { type: match[1] });
            formData.append('image', blob, `product.${ext}`);
            formData.append('prompt', `CRITICAL: The uploaded image shows the EXACT product that MUST appear in the generated image with 100% fidelity. Keep the product identical — same colors, shape, logos, text, materials. Place it prominently as the central subject.\n\n${prompt}`);
            formData.append('model', selectedModel);
            formData.append('n', '1');
            formData.append('size', '1024x1024');
            formData.append('quality', 'high');

            const resp = await fetch('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: formData,
            });

            if (!resp.ok) {
                const body = await resp.text();
                throw new Error(`OpenAI Image Edits API error ${resp.status}: ${body}`);
            }

            const data = await resp.json();
            if (data.data?.[0]?.b64_json) {
                return {
                    type: 'image',
                    mimeType: 'image/png',
                    data: data.data[0].b64_json,
                };
            }
            // If b64_json not returned, try URL
            if (data.data?.[0]?.url) {
                const imgResp = await fetch(data.data[0].url);
                const arrBuf = await imgResp.arrayBuffer();
                return {
                    type: 'image',
                    mimeType: 'image/png',
                    data: Buffer.from(arrBuf).toString('base64'),
                };
            }
            throw new Error('No image returned from OpenAI edits API');
        }
    }

    // DALL-E 3 or fallback: text-only generation with product description injected
    let enrichedPrompt = prompt;
    if (referenceImage) {
        const productDesc = await describeProductFromImage(referenceImage);
        enrichedPrompt = buildProductInjection(productDesc) + prompt;
        console.log('[generateImageOpenAI] Enriched prompt with product description for DALL-E 3');
    }

    const payload = {
        model: selectedModel,
        prompt: enrichedPrompt,
        n: 1,
        size: '1024x1024',
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
