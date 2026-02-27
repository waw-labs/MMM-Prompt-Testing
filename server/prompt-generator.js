/**
 * prompt-generator.js
 * AI-powered dynamic prompt generation for businesses.
 * Uses Gemini deep-thinking to generate premium ad/content prompts
 * tailored to a specific business profile.
 */

import { getWinningTemplates } from './winning-templates.js';

/**
 * Generates 10+ premium prompts for a specific category using AI.
 */
export async function generatePromptsForCategory(businessProfile, category, platform, contentType) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // Get winning templates for this category
    const templates = getWinningTemplates(category);
    const templateDescriptions = templates.map((t, i) =>
        `${i + 1}. ${t.name}: ${t.structure} | Visual: ${t.visual}${t.cta ? ` | CTA: ${t.cta}` : ''}`
    ).join('\n');

    const platformSpec = getPlatformSpecs(platform);
    const contentTypeSpec = getContentTypeSpecs(contentType);

    const prompt = `You are a world-class creative director who has produced award-winning campaigns for Nike, Apple, and Glossier. You specialize in high-converting social media creatives.

BUSINESS PROFILE:
- Business: ${businessProfile.name}
- Industry: ${businessProfile.industry}
- Products/Services: ${(businessProfile.products || []).join(', ')}
- USP: ${businessProfile.usp || 'N/A'}
- Target Audience: ${businessProfile.targetAudience || 'General consumers'}
- Brand Tone: ${businessProfile.brandTone || 'professional'}
- Brand Colors: ${(businessProfile.brandColors || []).join(', ') || 'not specified'}
- Price Range: ${businessProfile.priceRange || 'mid-range'}
- Pain Points: ${(businessProfile.painPoints || []).join(', ') || 'N/A'}
- Emotional Triggers: ${(businessProfile.emotionalTriggers || []).join(', ') || 'N/A'}
- Summary: ${businessProfile.summary || 'N/A'}

CONTENT CATEGORY: ${category.toUpperCase()}
PLATFORM: ${platform.toUpperCase()} ${platformSpec}
CONTENT TYPE: ${contentType.toUpperCase()} ${contentTypeSpec}

WINNING TEMPLATE FRAMEWORKS — use these as structural inspiration:
${templateDescriptions}

===

Generate exactly 12 unique, premium image generation prompts for this business. Each prompt must:

1. Be a COMPLETE image generation prompt ready for an AI image generator
2. Follow one of the winning template frameworks above (different one for each)
3. Be tailored to ${businessProfile.name}'s products, brand, and audience
4. Include ${platform}-native design language
5. Specify visual elements: colors, typography, layout, composition
6. Include text overlay content (headlines, CTAs) for this business
7. Be production-ready for a paid social media ad

QUALITY RULES:
- Every prompt must reference specific products, colors, or brand elements
- Each prompt uses a DIFFERENT template framework
- Progress from awareness (top) to conversion (bottom of funnel)
- CRITICAL: No social media UI elements in the image. Raw creative ONLY.
- Keep each prompt between 80-120 words. Be dense and specific, not verbose.

Return a JSON array of 12 objects with: "label" (3-5 words), "framework" (template name), "funnel" ("awareness"|"consideration"|"conversion"), "prompt" (the image gen prompt, 80-120 words).

Return ONLY the JSON array. No markdown wrapping.`;

    console.log(`[prompt-gen] Generating ${category} prompts for "${businessProfile.name}" on ${platform}`);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            temperature: 0.9,
            maxOutputTokens: 32768,
            responseMimeType: 'application/json',
        },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON response (with repair for truncated responses)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let prompts;
    try {
        prompts = JSON.parse(jsonStr);
    } catch (err) {
        console.warn('[prompt-gen] JSON parse failed, attempting repair:', err.message);
        // Try to rescue truncated JSON array
        prompts = repairTruncatedJSON(jsonStr);
        if (!prompts) {
            console.error('[prompt-gen] Repair failed. Raw:', jsonStr.substring(0, 500));
            throw new Error('Failed to generate prompts: Invalid AI response');
        }
        console.log(`[prompt-gen] Repaired JSON — rescued ${prompts.length} prompts`);
    }

    console.log(`[prompt-gen] Generated ${prompts.length} prompts for ${category}`);
    return prompts.map((p, i) => ({
        index: i,
        label: p.label || `${category} #${i + 1}`,
        framework: p.framework || 'custom',
        funnel: p.funnel || 'awareness',
        prompt: p.prompt,
    }));
}

/**
 * Attempts to repair a truncated JSON array by closing open strings/objects.
 */
function repairTruncatedJSON(str) {
    try {
        // Find the last complete object in the array
        let lastComplete = -1;
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (escaped) { escaped = false; continue; }
            if (c === '\\') { escaped = true; continue; }
            if (c === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (c === '{') depth++;
            if (c === '}') {
                depth--;
                if (depth === 0) lastComplete = i;
            }
        }

        if (lastComplete > 0) {
            const repaired = str.substring(0, lastComplete + 1) + ']';
            // Make sure it starts with [
            const start = repaired.indexOf('[');
            if (start >= 0) {
                return JSON.parse(repaired.substring(start));
            }
        }
    } catch (e) {
        // repair failed
    }
    return null;
}

/**
 * Generates prompts for ALL selected categories.
 * Returns results in the same format as /api/assemble for frontend compatibility.
 */
export async function generateAllCategoryPrompts(businessProfile, categories, platform, contentType) {
    const results = [];

    for (const category of categories) {
        try {
            const prompts = await generatePromptsForCategory(businessProfile, category, platform, contentType);
            results.push({
                category,
                niche: businessProfile.industry || 'general',
                platform,
                contentType,
                prompt: prompts[0]?.prompt || '',
                allPrompts: prompts,
                businessMode: true,
                businessName: businessProfile.name,
            });
        } catch (err) {
            console.error(`[prompt-gen] Error generating ${category}:`, err.message);
            results.push({
                category,
                error: `Failed to generate: ${err.message}`,
                businessMode: true,
            });
        }
    }

    return results;
}

function getPlatformSpecs(platform) {
    const specs = {
        instagram: '(4:5 portrait, 1080×1350px, feed-optimized)',
        facebook: '(4:5 portrait, 1080×1350px, news feed)',
        tiktok: '(9:16 vertical, 1080×1920px, full-screen)',
        youtube: '(16:9 landscape, 1920×1080px, thumbnail/community)',
        pinterest: '(2:3 vertical, 1000×1500px, pin grid)',
        x: '(16:9 landscape, 1200×675px, tweet card)',
    };
    return specs[platform] || '';
}

function getContentTypeSpecs(contentType) {
    const specs = {
        image: '(Static image creative)',
        video: '(Video thumbnail / key frame)',
        carousel: '(Multi-slide carousel, design first slide)',
        caption: '(Image + caption text)',
    };
    return specs[contentType] || '';
}
