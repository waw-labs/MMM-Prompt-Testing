/**
 * subniche-generator.js
 * 
 * Auto-detects specific subniches and generates complete niche entries
 * following the exact same JSON structure as existing niches.
 * New subniches are saved to disk and hot-reloaded into memory.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detect the SPECIFIC subniche for a product/business.
 * Goes beyond broad categories like "health_wellness" to detect
 * precise subniches like "posture_correction" or "teeth_whitening".
 *
 * @param {object} businessContext - Full business/product context
 * @param {string[]} existingNiches - Already known niche keys
 * @param {string} category - Category type (ads, social_posts, etc.)
 * @returns {Promise<{nicheKey: string, isNew: boolean, parentNiche: string}>}
 */
export async function detectSubniche(businessContext, existingNiches, category) {
    // Smart fallback: use industry from scraper instead of "general"
    const industryFallback = (businessContext?.industry || 'general').toLowerCase().replace(/[^a-z_]/g, '');
    const smartFallback = existingNiches.includes(industryFallback) ? industryFallback : 'general';

    if (!businessContext) return { nicheKey: smartFallback, isNew: false, parentNiche: smartFallback };

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return { nicheKey: smartFallback, isNew: false, parentNiche: smartFallback };

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const ctx = [];
        if (businessContext.name) ctx.push(`Name: ${businessContext.name}`);
        if (businessContext.industry) ctx.push(`Industry: ${businessContext.industry}`);
        if (businessContext.subIndustry) ctx.push(`Sub-industry: ${businessContext.subIndustry}`);
        if (businessContext.products?.length) ctx.push(`Products: ${businessContext.products.join(', ')}`);
        if (businessContext.usp) ctx.push(`USP: ${businessContext.usp}`);
        if (businessContext.productDescription) ctx.push(`Description: ${businessContext.productDescription}`);
        if (businessContext.summary) ctx.push(`Summary: ${businessContext.summary}`);

        const prompt = `You are a marketing niche classifier. Analyze this product/business and determine its EXACT specific subniche.

PRODUCT/BUSINESS DATA:
${ctx.join('\n')}

EXISTING NICHES IN OUR SYSTEM:
${existingNiches.join(', ')}

INSTRUCTIONS:
1. First check if the product fits EXACTLY into one of the existing niches above. If it does, return that niche.
2. If it doesn't fit precisely, determine the SPECIFIC subniche. Be granular — not "health_wellness" but "posture_correction", not "beauty_skincare" but "teeth_whitening", not "tech_gadgets" but "smart_home_security".
3. Determine the PARENT niche from our existing list that this subniche falls under.

Return ONLY a JSON object (no markdown, no backticks):
{"nicheKey": "the_subniche_key", "parentNiche": "closest_existing_parent", "isNew": true/false}

Rules for nicheKey:
- lowercase_snake_case only
- 2-4 words max
- Must be specific and descriptive
- isNew = false if the nicheKey matches an existing niche exactly
- isNew = true if it's a new subniche not in our system`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                maxOutputTokens: 256,
                temperature: 0.2,
                // No google search here — it's a simple classification, search adds noise
            },
        });

        // Robust JSON extraction — handle markdown fences, mixed text, etc.
        const raw = (response.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        const result = extractJSON(raw);

        if (!result || !result.nicheKey) {
            console.warn(`[subniche] Could not parse AI response, using industry: "${industryFallback}". Raw: ${raw.substring(0, 100)}`);
            return { nicheKey: smartFallback, isNew: false, parentNiche: smartFallback };
        }

        const nicheKey = (result.nicheKey || smartFallback).toLowerCase().replace(/[^a-z_]/g, '');
        const parentNiche = (result.parentNiche || smartFallback).toLowerCase().replace(/[^a-z_]/g, '');
        const isNew = !existingNiches.includes(nicheKey);

        console.log(`[subniche] Detected: "${nicheKey}" (parent: ${parentNiche}, new: ${isNew})`);
        return { nicheKey, parentNiche, isNew };
    } catch (err) {
        console.error('[subniche] Detection failed:', err.message);
        // Fall back to industry detected by scraper, NOT "general"
        console.log(`[subniche] Falling back to scraped industry: "${smartFallback}"`);
        return { nicheKey: smartFallback, isNew: false, parentNiche: smartFallback };
    }
}

/**
 * Robustly extract a JSON object from mixed AI response text.
 * Handles: markdown fences, mixed prose, search grounding artifacts, etc.
 */
function extractJSON(text) {
    if (!text) return null;

    // Step 1: Try direct parse
    try { return JSON.parse(text); } catch { }

    // Step 2: Remove markdown fences and retry
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try { return JSON.parse(cleaned); } catch { }

    // Step 3: Extract first {...} block using bracket matching
    const start = cleaned.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
        if (cleaned[i] === '{') depth++;
        if (cleaned[i] === '}') depth--;
        if (depth === 0) { end = i; break; }
    }

    if (end === -1) return null;

    const jsonStr = cleaned.substring(start, end + 1);
    try { return JSON.parse(jsonStr); } catch { }

    // Step 4: Try fixing common issues (unescaped quotes, trailing commas)
    try {
        const fixed = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(fixed);
    } catch { }

    return null;
}

/**
 * Generate a complete niche entry following the EXACT structure of existing niches.
 * Uses an existing niche as a skeleton/template reference.
 *
 * @param {string} subnicheKey - The subniche key (e.g., "posture_correction")
 * @param {string} category - Category type (ads, social_posts, etc.)
 * @param {object} businessContext - Full business/product context
 * @param {object} exampleNiche - An existing niche object to use as structural reference
 * @param {string} exampleNicheKey - Key of the example niche (for context)
 * @returns {Promise<object|null>} - Complete niche entry or null on failure
 */
export async function generateSubnicheEntry(subnicheKey, category, businessContext, exampleNiche, exampleNicheKey) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const nicheLabel = subnicheKey.replace(/_/g, ' ');
        const categoryLabel = category.replace(/_/g, ' ');

        // Build context
        const ctx = [];
        if (businessContext.name) ctx.push(`Example brand: ${businessContext.name}`);
        if (businessContext.industry) ctx.push(`Industry: ${businessContext.industry}`);
        if (businessContext.usp) ctx.push(`USP: ${businessContext.usp}`);
        if (businessContext.targetAudience) ctx.push(`Target Audience: ${businessContext.targetAudience}`);
        if (businessContext.painPoints?.length) ctx.push(`Pain Points: ${businessContext.painPoints.join('; ')}`);
        if (businessContext.emotionalTriggers?.length) ctx.push(`Emotional Triggers: ${businessContext.emotionalTriggers.join('; ')}`);

        const exampleJson = JSON.stringify(exampleNiche, null, 2);

        const systemPrompt = `You are an expert marketing prompt engineer. You generate complete niche configuration entries for an AI image generation system.

YOUR TASK: Generate a COMPLETE niche entry for "${nicheLabel}" in the "${categoryLabel}" category.

CRITICAL RULES:
1. Follow the EXACT same JSON structure as the example — same keys, same types, same number of items
2. All prompts must use {{ .Title }} and {{ .Description }} as placeholders
3. master_prompts: Generate 8 unique prompts covering different ad/post types (transformation, social proof, urgency, comparison, etc.)
4. video_prompts: Generate 3 unique video prompts
5. carousel_prompt: Generate 1 carousel prompt
6. caption_templates: Generate 5 unique captions
7. platform_adaptation: Include entries for ALL platforms: tiktok, instagram, facebook, pinterest, youtube, x, and meta
8. visual_direction: Include realistic lighting, 4-5 brand-appropriate colors, and 6-8 scenarios
9. Make prompts SPECIFIC to the "${nicheLabel}" niche — not generic
10. Research what ad formats and visual styles work best for ${nicheLabel} products
11. Each prompt should describe a complete visual layout — not just a concept
12. Return ONLY valid JSON — no markdown fences, no explanations`;

        const userMessage = `NICHE TO GENERATE: "${nicheLabel}"
CATEGORY: ${categoryLabel}
CONTEXT ABOUT THIS NICHE:
${ctx.join('\n')}

REFERENCE EXAMPLE (for "${exampleNicheKey}" niche — copy the EXACT structure but make content specific to "${nicheLabel}"):
${exampleJson}

Generate the complete niche entry for "${nicheLabel}". Return ONLY the JSON object.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            config: {
                systemInstruction: systemPrompt,
                maxOutputTokens: 8192,
                temperature: 0.7,
                tools: [{ googleSearch: {} }],
            },
        });

        const raw = (response.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const entry = JSON.parse(cleaned);

        // Validate the structure has required fields
        const requiredFields = ['core_emotion', 'visual_direction', 'master_prompts', 'platform_adaptation', 'product_rule'];
        const missing = requiredFields.filter(f => !entry[f]);
        if (missing.length > 0) {
            console.error(`[subniche-gen] Generated entry missing fields: ${missing.join(', ')}`);
            return null;
        }

        // Ensure arrays have minimum items
        if (!Array.isArray(entry.master_prompts) || entry.master_prompts.length < 3) {
            console.error('[subniche-gen] master_prompts too few');
            return null;
        }

        // Ensure optional arrays exist with defaults
        if (!entry.video_prompts) entry.video_prompts = [];
        if (!entry.caption_templates) entry.caption_templates = [];
        if (!entry.carousel_prompt) entry.carousel_prompt = '';

        console.log(`[subniche-gen] ✅ Generated "${subnicheKey}": ${entry.master_prompts.length} prompts, ${entry.video_prompts.length} video, ${Object.keys(entry.platform_adaptation).length} platforms`);
        return entry;
    } catch (err) {
        console.error(`[subniche-gen] Generation failed for "${subnicheKey}":`, err.message);
        return null;
    }
}

/**
 * Save a new subniche entry to a JSON prompt file on disk.
 * Reads the file, adds the entry under niches, writes back.
 *
 * @param {string} category - Category key (ads, social_posts, etc.)
 * @param {string} subnicheKey - The subniche key
 * @param {object} entry - The complete niche entry
 * @returns {boolean} - true if saved successfully
 */
export function saveSubnicheToDisk(category, subnicheKey, entry) {
    try {
        const filePath = join(__dirname, 'prompts', `prompts_${category}.json`);
        const config = JSON.parse(readFileSync(filePath, 'utf-8'));

        if (!config.niches) config.niches = {};
        config.niches[subnicheKey] = entry;

        writeFileSync(filePath, JSON.stringify(config, null, 4), 'utf-8');
        console.log(`[subniche-save] ✅ Saved "${subnicheKey}" to prompts_${category}.json`);
        return true;
    } catch (err) {
        console.error(`[subniche-save] Failed to save "${subnicheKey}":`, err.message);
        return false;
    }
}

/**
 * Full pipeline: detect subniche → generate if new → save → return niche key.
 * This is the main function called from the assemble endpoint.
 *
 * @param {object} businessContext - Full business/product context
 * @param {object} promptConfigs - In-memory prompt configs (will be mutated to add new niche)
 * @param {string} category - Category key
 * @returns {Promise<string>} - The resolved niche key to use
 */
export async function resolveSubniche(businessContext, promptConfigs, category) {
    const config = promptConfigs[category];
    if (!config) return 'general';

    const existingNiches = Object.keys(config.niches || {});

    // Step 1: Detect the specific subniche
    const { nicheKey, parentNiche, isNew } = await detectSubniche(businessContext, existingNiches, category);

    if (!isNew) {
        // Subniche already exists — use it directly
        return nicheKey;
    }

    // Step 2: Generate the new subniche entry
    // Use parent niche as the structural reference (or first available niche)
    const exampleNicheKey = existingNiches.includes(parentNiche) ? parentNiche : existingNiches[0] || 'general';
    const exampleNiche = config.niches?.[exampleNicheKey];

    if (!exampleNiche) {
        console.warn(`[subniche] No example niche found for reference, falling back to "${parentNiche}"`);
        return existingNiches.includes(parentNiche) ? parentNiche : 'general';
    }

    console.log(`[subniche] 🔨 Generating new subniche "${nicheKey}" using "${exampleNicheKey}" as template...`);
    const entry = await generateSubnicheEntry(nicheKey, category, businessContext, exampleNiche, exampleNicheKey);

    if (!entry) {
        console.warn(`[subniche] Generation failed, falling back to parent: "${parentNiche}"`);
        return existingNiches.includes(parentNiche) ? parentNiche : 'general';
    }

    // Step 3: Save to disk (persistent)
    saveSubnicheToDisk(category, nicheKey, entry);

    // Step 4: Hot-reload into memory (no restart needed)
    if (!config.niches) config.niches = {};
    config.niches[nicheKey] = entry;

    console.log(`[subniche] ✅ New subniche "${nicheKey}" is live! (${entry.master_prompts.length} prompts)`);
    return nicheKey;
}
