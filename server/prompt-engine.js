/**
 * prompt-engine.js
 * JavaScript port of the Go SelectPrompt / classifyNiche / normalizePlatform logic.
 * Enhanced with platform-specific technical direction, photography-grade prompt enrichment,
 * and anti-artifact negative prompting for professional AI image generation.
 */

/**
 * refinePromptWithAI — Full AI Creative Strategist.
 * 
 * This doesn't just "refine" — it asks Gemini to:
 * 1. Research current winning ad/post formats trending in this niche
 * 2. Analyze what visual styles are going viral right now
 * 3. Validate the prompt against proven engagement frameworks
 * 4. Regenerate a 100% optimized prompt for maximum engagement
 * 
 * Uses Google Search grounding for real-time trend data.
 * Falls back to the original prompt if anything fails.
 *
 * @param {string} basePrompt - The assembled template prompt
 * @param {object} businessContext - Full business/product context
 * @returns {Promise<string>} - Strategist-optimized prompt
 */
export async function refinePromptWithAI(basePrompt, businessContext) {
    if (!businessContext || !basePrompt) return basePrompt;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return basePrompt;

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        // Build rich context from all available business data
        const ctx = [];
        if (businessContext.name) ctx.push(`Brand/Product Name: "${businessContext.name}"`);
        if (businessContext.industry) ctx.push(`Industry/Niche: ${businessContext.industry.replace(/_/g, ' ')}`);
        if (businessContext.subIndustry) ctx.push(`Sub-niche: ${businessContext.subIndustry}`);
        if (businessContext.usp) ctx.push(`Unique Selling Proposition: ${businessContext.usp}`);
        if (businessContext.targetAudience) ctx.push(`Target Audience: ${businessContext.targetAudience}`);
        if (businessContext.brandTone) ctx.push(`Brand Voice/Tone: ${businessContext.brandTone}`);
        if (businessContext.brandColors?.length) ctx.push(`Brand Colors: ${businessContext.brandColors.join(', ')}`);
        if (businessContext.productPrice) ctx.push(`Product Price: $${businessContext.productPrice}`);
        if (businessContext.originalPrice) ctx.push(`Original Price: $${businessContext.originalPrice}`);
        if (businessContext.discount) ctx.push(`Discount: ${businessContext.discount}`);
        if (businessContext.priceRange) ctx.push(`Price Positioning: ${businessContext.priceRange}`);
        if (businessContext.painPoints?.length) ctx.push(`Customer Pain Points: ${businessContext.painPoints.join('; ')}`);
        if (businessContext.emotionalTriggers?.length) ctx.push(`Emotional Triggers: ${businessContext.emotionalTriggers.join('; ')}`);
        if (businessContext.summary) ctx.push(`Business Summary: ${businessContext.summary}`);
        if (businessContext.products?.length) ctx.push(`Products/Services: ${businessContext.products.join(', ')}`);
        if (businessContext.productDescription) ctx.push(`Product Description: ${businessContext.productDescription}`);
        if (businessContext.productColors?.length) ctx.push(`Product Color Variants: ${businessContext.productColors.join(', ')}`);
        if (businessContext.logoUrl) ctx.push(`Brand Logo URL: ${businessContext.logoUrl}`);

        const nicheLabel = (businessContext.industry || 'ecommerce').replace(/_/g, ' ');
        const platform = businessContext.platform || 'instagram';

        const systemPrompt = `You are a SENIOR CREATIVE STRATEGIST at a top performance marketing agency. You specialize in creating ad creatives and social media visuals that go viral and convert at 3-5x industry benchmarks.

YOUR MISSION:
You will receive a base image-generation prompt and full brand context. Your job is NOT to simply rewrite the prompt. You must:

1. RESEARCH & VALIDATE: Use your knowledge (and search if available) to understand what types of ${nicheLabel} ads and visuals are currently winning on ${platform}. What hooks stop the scroll? What color psychology works? What layout patterns get the highest CTR?

2. APPLY WINNING FRAMEWORKS: Choose the best psychological framework for this specific product:
   - PAS (Problem → Agitate → Solve) for pain-point products
   - AIDA (Attention → Interest → Desire → Action) for aspirational products
   - Social Proof First for trust-dependent products
   - Scarcity/Urgency for deals and limited offers
   - Before/After for transformation products
   - Authority/Expert for health/wellness/supplements

3. OPTIMIZE THE VISUAL DIRECTION based on what's trending:
   - What color schemes are performing in ${nicheLabel} right now?
   - What typography styles (bold sans-serif vs elegant serif vs handwritten) resonate with this audience?
   - What layout patterns (minimalist, split-screen, floating elements, gradient backgrounds) are converting?
   - What kind of hero shots (lifestyle vs product-only vs macro vs flat-lay) work best?

4. CRAFT SCROLL-STOPPING COPY: The text elements in the prompt (headlines, CTAs, social proof) should use:
   - Exact brand data (real prices, real discounts, real review counts if available)
   - Power words proven to convert in this niche
   - Specificity over generics ("Loved by 10,427 customers" not "Loved by thousands")
   - Platform-native language (how people talk on ${platform})

5. UPGRADE ALL CTAs — THIS IS CRITICAL:
   - NEVER use passive generic CTAs like "Shop Now", "Buy Now", "Learn More", or "Get Yours"
   - USE high-intent, reward-based, first-person CTAs that make the user feel they're claiming a benefit:
     * "Claim My [Product] Kit" / "Claim My Discount"
     * "Start My 30-Day [Benefit] Challenge"
     * "Unlock My [Percentage] Off"
     * "Get My Free [Trial/Sample/Guide]"
     * "Join [Number]+ [People Who Benefit]"
     * "Yes, Fix My [Pain Point]"
     * "Reserve My Spot" / "Save My [Deal]"
   - The CTA must feel like the user is GETTING something, not being SOLD something
   - First-person ("My") outperforms second-person ("Your") in CTAs by 90%
   - Match CTA intensity to the offer: free trial = soft CTA, flash sale = urgent CTA

6. OUTPUT: Return ONLY the final, optimized image-generation prompt. No explanations, no analysis, no options. Just one prompt that will generate the most engaging, scroll-stopping, high-converting visual possible.

CONSTRAINTS:
- Keep the same general ad TYPE/FORMAT (if it's a social proof ad, keep it as social proof — but make it the BEST social proof ad)
- Keep the same aspect ratio and format directives
- Do NOT add social media UI overlays, phone frames, or platform interfaces
- Use the brand's EXACT prices, colors, and data — never invent numbers
- The prompt must work as an AI image generation prompt (describe visuals, not concepts)`;

        const userMessage = `FULL BRAND/PRODUCT CONTEXT:
${ctx.join('\n')}

TARGET PLATFORM: ${platform}
NICHE: ${nicheLabel}

BASE PROMPT TO OPTIMIZE:
${basePrompt}

Search for what's currently working in ${nicheLabel} advertising on ${platform}. What visual styles, hooks, and formats are getting the highest engagement right now? Then take the base prompt above and transform it into the most effective, trend-aligned, engagement-optimized image generation prompt possible for this specific brand. Use real brand data throughout.

Return ONLY the optimized prompt — nothing else.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            config: {
                systemInstruction: systemPrompt,
                maxOutputTokens: 3000,
                temperature: 0.8,
                tools: [{ googleSearch: {} }],
            },
        });

        const refined = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (refined && refined.length > 80) {
            console.log(`[strategist] ✅ Optimized prompt (${basePrompt.length} → ${refined.length} chars) with trend research`);
            return refined;
        }

        return basePrompt;
    } catch (err) {
        console.error('[strategist] AI optimization failed, using original:', err.message);
        return basePrompt;
    }
}

/**
 * normalizePlatform maps social platform values to prompt config keys.
 */
export function normalizePlatform(social) {
    const s = (social || '').toLowerCase();
    switch (s) {
        case 'facebook':
            return 'facebook';
        case 'instagram':
            return 'instagram';
        case 'tiktok':
            return 'tiktok';
        case 'youtube':
            return 'youtube';
        case 'pinterest':
            return 'pinterest';
        case 'x':
        case 'twitter':
            return 'x';
        default:
            return 'instagram';
    }
}

/**
 * Maps platform to the prompt config key used for platform data lookup.
 * Some platforms share config (facebook/instagram → meta).
 */
function platformConfigKey(platform) {
    const key = normalizePlatform(platform);
    if (key === 'facebook' || key === 'instagram') return 'meta';
    return key;
}

// ═══════════════════════════════════════════════════════════════════════
// Platform-Specific Technical Direction
// ═══════════════════════════════════════════════════════════════════════

const PLATFORM_ASPECT_RATIOS = {
    instagram: { image: '4:5 portrait (1080×1350px)', video: '9:16 vertical (1080×1920px)', carousel: '4:5 portrait (1080×1350px)' },
    facebook: { image: '4:5 portrait (1080×1350px)', video: '9:16 vertical (1080×1920px)', carousel: '1:1 square (1080×1080px)' },
    tiktok: { image: '9:16 vertical (1080×1920px)', video: '9:16 vertical (1080×1920px)', carousel: '9:16 vertical (1080×1920px)' },
    youtube: { image: '16:9 landscape (1920×1080px)', video: '16:9 landscape (1920×1080px)', carousel: '16:9 landscape (1920×1080px)' },
    pinterest: { image: '2:3 vertical pin (1000×1500px)', video: '2:3 vertical (1000×1500px)', carousel: '2:3 vertical pin (1000×1500px)' },
    x: { image: '16:9 landscape (1200×675px)', video: '16:9 landscape (1920×1080px)', carousel: '1:1 square (1080×1080px)' },
};

const PLATFORM_STYLE_DIRECTIVES = {
    instagram: `INSTAGRAM NATIVE STYLE:
- Feed-cohesive design that fits a curated aesthetic grid
- 4:5 portrait maximizes screen real estate on mobile
- Bold sans-serif typography (Inter, Neue Haas, Montserrat style)
- Clean full-bleed design — do NOT add any Instagram UI, icons, navigation bars, or status bars
- Pastel-to-bold gradient backgrounds trending in 2025
- Chunky carousel-friendly modular design if applicable
- Think "save-worthy" — content people bookmark for later`,

    facebook: `FACEBOOK NATIVE STYLE:
- Community-first, shareable design that sparks discussion
- 4:5 portrait for maximum mobile news feed visibility
- Clear readable text even at smaller feed preview sizes
- Warm approachable tone — think community group post aesthetic
- Design for shares and comment tags, not just likes
- Middle-aged demographic friendly — avoid overly Gen-Z aesthetics`,

    tiktok: `TIKTOK NATIVE STYLE:
- Full-screen 9:16 vertical — use EVERY pixel of screen
- Lo-fi authentic UGC feel — NOT polished corporate design
- Bold Impact/compressed font text overlays with slight rotation
- CRITICAL: Do NOT render any TikTok UI elements — no navigation bar, no Home/Friends/Profile buttons, no status bar, no hearts, no share icons, no comments. Generate ONLY the creative content itself as a clean standalone image.
- Raw, unfiltered aesthetic beats professional production
- Think "I stopped scrolling for this" energy`,

    youtube: `YOUTUBE NATIVE STYLE:
- 16:9 landscape community post or thumbnail-style design
- High contrast colors that pop at small sizes in feed
- Bold condensed typography (3-6 words max for any text)
- Face + text + bright color = YouTube's winning formula
- Clean uncluttered composition with strong focal point
- Design for discussion — community tab engagement format`,

    pinterest: `PINTEREST NATIVE STYLE:
- 2:3 vertical tall pin format — maximizes pin grid visibility
- Aspirational, curated, "vision board" aesthetic
- Soft muted tones OR bold high-contrast — both work for saves
- Clean text overlay with serif or elegant sans-serif fonts
- Step-by-step visual guides and numbered lists perform best
- Think "inspiration discovery" — users are planning and dreaming
- Include subtle text overlays that explain the pin's value`,

    x: `X (TWITTER) NATIVE STYLE:
- 16:9 landscape for maximum tweet preview visibility
- High-contrast, bold, opinionated visual design
- Minimal text — one sharp statement or hot take
- Dark mode friendly — ensure readability on dark backgrounds
- Meme-adjacent aesthetic — sharp, witty, retweet-worthy
- Think "quote tweet bait" — controversial enough to engage`,
};

const PHOTOGRAPHY_TECHNICAL = {
    product: `PHOTOGRAPHY TECHNICAL DIRECTION:
- Lens: 85mm equivalent, f/2.8-f/4 aperture for product isolation
- Lighting: 3-point studio setup — key light at 45°, fill light opposite, rim light behind
- Focus: Tack-sharp on product, gentle background blur (shallow depth of field)
- Color: True-to-life, calibrated white balance, no oversaturation
- Resolution: Ultra high detail, 4K-quality rendering
- Composition: Rule of thirds, product at visual power point`,

    lifestyle: `PHOTOGRAPHY TECHNICAL DIRECTION:
- Lens: 35mm-50mm equivalent for natural perspective
- Lighting: Soft natural window light or golden hour warmth
- Focus: Product sharp, environment slightly soft
- Color: Warm candid tones, lifestyle magazine quality
- Composition: Environmental context, product in natural use scenario
- Feel: Authentic moment captured, not staged`,

    flat_lay: `PHOTOGRAPHY TECHNICAL DIRECTION:
- Lens: 50mm equivalent, directly overhead shot
- Lighting: Even diffused lighting, minimal shadows
- Focus: Sharp edge-to-edge (deep depth of field, f/8+)
- Color: Cohesive color palette, styled arrangement
- Composition: Symmetrical or organized chaos layout
- Surface: Clean textured background (marble, wood, linen)`,

    graphic: `DESIGN TECHNICAL DIRECTION:
- Typography: Modern sans-serif, high contrast against background
- Layout: Clear visual hierarchy — headline > subtext > supporting elements
- Colors: Bold brand-appropriate palette, 2-3 colors max
- Spacing: Generous whitespace, no visual clutter
- Grid: Aligned to clean modular grid system
- Text: All text must be crisp, readable, and properly kerned`,
};

const ANTI_ARTIFACT = `
QUALITY REQUIREMENTS — AVOID THESE COMMON AI FAILURES:
- NO blurry or soft areas — everything must be crisp
- NO distorted text, misspelled words, or garbled letterforms
- NO extra fingers, limbs, or anatomical errors on any people
- NO watermarks, stock photo badges, or artificial borders
- NO oversaturated neon colors unless explicitly requested
- NO cluttered compositions — maintain clear visual hierarchy
- NO generic clip-art style — everything must feel premium and intentional
- CRITICAL: Do NOT add any social media app UI overlays, navigation bars, status bars, home buttons, like/share/comment icons, profile icons, or any platform interface elements. Generate ONLY the raw creative content as a clean standalone image. No phone frames, no app screenshots, no simulated social media interfaces.`;

// ── CTA Upgrade System ──────────────────────────────────────────────
// Replaces passive, generic CTAs with high-intent, reward-based alternatives.
// First-person ("My") outperforms second-person ("Your") by ~90% in ads.

const NICHE_CTA_MAP = {
    fitness: ['Start My Transformation', 'Claim My Fitness Kit', 'Unlock My Results', 'Join 50K+ Athletes'],
    beauty_skincare: ['Claim My Glow Kit', 'Start My Skin Journey', 'Unlock My Radiance', 'Yes, Transform My Skin'],
    health_wellness: ['Start My Wellness Journey', 'Claim My Health Kit', 'Yes, Fix My Pain', 'Unlock My Vitality'],
    supplements: ['Start My Stack Today', 'Claim My Trial', 'Unlock My Peak Performance', 'Yes, Boost My Energy'],
    home_organization: ['Claim My Organization Kit', 'Yes, Fix My Space', 'Start My Home Makeover', 'Unlock My Calm'],
    tech_gadgets: ['Claim My Upgrade', 'Unlock Smart Living', 'Yes, Upgrade My Setup', 'Reserve My Unit'],
    fashion_apparel: ['Claim My Look', 'Unlock My Style', 'Yes, Elevate My Wardrobe', 'Reserve My Size'],
    food_beverage: ['Claim My Taste Box', 'Start My Flavor Journey', 'Unlock My Deal', 'Yes, Feed Me Better'],
    pets: ['Claim My Pet Kit', 'Start My Pet\'s Glow-Up', 'Yes, Treat My Fur Baby', 'Unlock Pet Wellness'],
    baby_kids: ['Claim My Baby Kit', 'Yes, Protect My Little One', 'Start My Parenting Win', 'Unlock Safe Comfort'],
    automotive: ['Claim My Performance Kit', 'Unlock My Horsepower', 'Yes, Upgrade My Ride', 'Reserve My Parts'],
    garden_outdoor: ['Claim My Garden Kit', 'Start My Green Makeover', 'Yes, Grow My Garden', 'Unlock My Harvest'],
    sports: ['Claim My Gear', 'Start My Champion Journey', 'Unlock My Edge', 'Yes, Level Up My Game'],
    education_learning: ['Claim My Access', 'Start My Learning Path', 'Unlock My Potential', 'Yes, Invest In Me'],
    general: ['Claim My Deal', 'Unlock My Discount', 'Yes, I Want This', 'Reserve Mine Now'],
};

// Passive CTAs to match (case-insensitive)
const PASSIVE_CTA_PATTERNS = [
    /['"](Shop Now)['"]/gi,
    /['"](Buy Now)['"]/gi,
    /['"](Get Yours)['"]/gi,
    /['"](Get Yours Today)['"]/gi,
    /['"](Get Yours Now)['"]/gi,
    /['"](Learn More)['"]/gi,
    /['"](Order Now)['"]/gi,
    /['"](Get Yours Before It Is Gone)['"]/gi,
    /['"](Shop Now — Link in Bio)['"]/gi,
    /['"](Grab Yours)['"]/gi,
    /['"](Try It Now)['"]/gi,
    /['"](See More)['"]/gi,
    /['"](Get It Now)['"]/gi,
    /['"](Buy It Now)['"]/gi,
    /['"](Get Started)['"]/gi,
    /['"](Start Now)['"]/gi,
    /['"](Claim Your Deal)['"]/gi,
    /['"](Join Them — Shop Now)['"]/gi,
    /['"](Try It Yourself — Shop Now)['"]/gi,
];

// Unquoted CTA patterns in prompt text
const UNQUOTED_CTA_PATTERNS = [
    /Shop Now(?:\s+(?:CTA|button))/gi,
    /Buy Now(?:\s+(?:CTA|button))/gi,
    /Order Now(?:\s+(?:CTA|button))/gi,
    /Get Yours(?:\s+(?:CTA|button))/gi,
    /'Shop Now'/gi,
    /'Buy Now'/gi,
    /'Order Now'/gi,
];

/**
 * Upgrade generic passive CTAs to high-intent, reward-based CTAs.
 * Works on both business-mode and non-business-mode prompts.
 */
function upgradeGenericCTAs(text, title, businessContext) {
    if (!text) return text;

    // Determine niche for CTA selection
    const nicheKey = businessContext?.resolvedNiche || detectNicheFromText(text);
    const ctaPool = NICHE_CTA_MAP[nicheKey] || NICHE_CTA_MAP.general;

    // If we have a product name, create personalized CTAs
    const productName = title || businessContext?.name || '';
    const personalizedCTAs = [...ctaPool];
    if (productName && productName.length < 30) {
        personalizedCTAs.push(`Claim My ${productName}`);
    }

    let ctaIndex = 0;
    const getNextCTA = () => {
        const cta = personalizedCTAs[ctaIndex % personalizedCTAs.length];
        ctaIndex++;
        return cta;
    };

    let result = text;

    // Replace quoted passive CTAs
    for (const pattern of PASSIVE_CTA_PATTERNS) {
        result = result.replace(pattern, (match) => {
            const quote = match[0]; // preserve quote style
            return `${quote}${getNextCTA()}${quote}`;
        });
    }

    // Replace unquoted CTAs in prompt directives
    for (const pattern of UNQUOTED_CTA_PATTERNS) {
        result = result.replace(pattern, (match) => {
            const suffix = match.match(/\s+(CTA|button)/i)?.[0] || '';
            return `${getNextCTA()}${suffix}`;
        });
    }

    return result;
}

/**
 * Quick niche detection from prompt text for CTA selection.
 */
function detectNicheFromText(text) {
    const lower = (text || '').toLowerCase();
    if (/fitness|workout|gym|muscle|athlete/.test(lower)) return 'fitness';
    if (/skin|beauty|glow|serum|cream/.test(lower)) return 'beauty_skincare';
    if (/health|wellness|clinic|doctor/.test(lower)) return 'health_wellness';
    if (/supplement|vitamin|stack|capsule/.test(lower)) return 'supplements';
    if (/home|organiz|declutter|storage/.test(lower)) return 'home_organization';
    if (/tech|gadget|smart|device/.test(lower)) return 'tech_gadgets';
    if (/fashion|apparel|outfit|style|wardrobe/.test(lower)) return 'fashion_apparel';
    if (/food|recipe|taste|meal|kitchen/.test(lower)) return 'food_beverage';
    if (/pet|dog|cat|fur baby|paw/.test(lower)) return 'pets';
    if (/baby|kid|toddler|parent|child/.test(lower)) return 'baby_kids';
    if (/car|auto|vehicle|engine|performance/.test(lower)) return 'automotive';
    if (/garden|plant|grow|outdoor|green/.test(lower)) return 'garden_outdoor';
    if (/sport|athletic|game|champion/.test(lower)) return 'sports';
    if (/learn|course|education|student/.test(lower)) return 'education_learning';
    return 'general';
}

/**
 * Replace Go template variables {{ .Title }} and {{ .Description }} with actual values.
 * Also upgrades generic passive CTAs to high-intent reward-based CTAs.
 */
export function renderTemplate(text, title, description, businessContext) {
    if (!text) return '';
    let result = text
        .replace(/\{\{\s*\.Title\s*\}\}/g, title || '')
        .replace(/\{\{\s*\.Description\s*\}\}/g, description || '');

    // Upgrade passive CTAs to high-intent, reward-based CTAs
    result = upgradeGenericCTAs(result, title, businessContext);

    // If business context is available, replace hardcoded values with real data
    if (businessContext) {
        // Replace prices in the prompt with actual product price
        if (businessContext.productPrice) {
            // Replace generic price patterns: '$49.99', '$500', etc.
            result = result.replace(/\$[\d,]+(?:\.\d{2})?/g, (match) => {
                // Don't replace prices that are clearly comparison/context prices (very large like $500K, $10K)
                const num = parseFloat(match.replace(/[$,]/g, ''));
                if (num > 5000) return match; // keep large context numbers
                return `$${businessContext.productPrice}`;
            });
        }

        // Replace discount percentages with actual discount (if available)
        if (businessContext.discount) {
            result = result.replace(/\d+%\s*(?:OFF|off|Off)/g, `${businessContext.discount} OFF`);
            result = result.replace(/Save\s+\d+%/gi, `Save ${businessContext.discount}`);
        }

        // Replace brand/product name references where the template uses generic labels
        if (businessContext.name) {
            // Replace generic brand references in headlines/CTAs
            result = result.replace(/'THE COMPLETE (?:ROUTINE|KIT|SETUP|GEAR KIT|CARE KIT|OUTFIT|STACK|BUNDLE|LEARNING PATH|GARDEN KIT|DAILY STACK) —/gi,
                `'THE COMPLETE ${businessContext.name.toUpperCase()} —`);
        }
    }

    return result;
}

/**
 * Builds a BRAND IDENTITY prompt block from businessContext.
 * Returns empty string if no business context is provided.
 */
function buildBrandBlock(businessContext) {
    if (!businessContext) return '';

    const parts = ['\n\nBRAND IDENTITY — Apply these brand guidelines to the creative:'];

    if (businessContext.name) {
        parts.push(`- Brand Name: "${businessContext.name}" — use this name in any text overlays, headlines, or CTAs`);
    }

    if (businessContext.brandColors?.length > 0) {
        parts.push(`- Brand Colors: ${businessContext.brandColors.join(', ')} — use these as the PRIMARY color palette. Replace any generic colors in the design with these brand colors`);
    }

    if (businessContext.brandTone) {
        parts.push(`- Brand Tone: ${businessContext.brandTone} — visual feel and copy must match`);
    }

    if (businessContext.productPrice) {
        parts.push(`- Actual Product Price: $${businessContext.productPrice} — use this EXACT price in any price displays, sale graphics, or offer overlays`);
    }

    if (businessContext.originalPrice && businessContext.discount) {
        parts.push(`- Sale Info: Original $${businessContext.originalPrice} → Now $${businessContext.productPrice} (${businessContext.discount} OFF) — use these exact numbers in sale/discount creatives`);
    }

    if (businessContext.usp) {
        parts.push(`- USP: ${businessContext.usp} — weave into headlines and messaging`);
    }

    if (businessContext.targetAudience) {
        parts.push(`- Target Audience: ${businessContext.targetAudience} — design should resonate with this demographic`);
    }

    if (businessContext.priceRange) {
        const priceVisual = {
            'budget': 'Accessible, value-focused visuals. Bold deals, bright colors',
            'mid-range': 'Clean, polished design. Professional but approachable',
            'premium': 'Elevated, sophisticated design. Rich textures, refined typography',
            'luxury': 'Ultra-minimal, editorial quality. Lots of white space, serif fonts, muted tones',
        };
        parts.push(`- Price Positioning: ${businessContext.priceRange} — ${priceVisual[businessContext.priceRange] || 'professional quality'}`);
    }

    if (businessContext.painPoints?.length > 0) {
        parts.push(`- Pain Points: ${businessContext.painPoints.join('; ')} — address these`);
    }

    if (businessContext.emotionalTriggers?.length > 0) {
        parts.push(`- Emotional Hooks: ${businessContext.emotionalTriggers.join('; ')} — evoke these feelings`);
    }

    if (businessContext.industry) {
        parts.push(`- Industry: ${businessContext.industry.replace(/_/g, ' ')} — ensure visual language is native to this space`);
    }

    return parts.join('\n');
}

/**
 * categoryInstruction returns category-specific critical requirements.
 */
export function categoryInstruction(category) {
    switch (category) {
        case 'ads':
            return `

CRITICAL REQUIREMENTS — THIS IS AN ADVERTISEMENT, NOT A PHOTOGRAPH:
1. BOLD HEADLINE TEXT: Large attention-grabbing headline text prominently placed on the image. The text must be readable and dominant.
2. CLEAN PRODUCT SHOT: Product displayed clearly on a clean, minimal background (solid color, subtle gradient, or simple texture). NOT a lifestyle photo scene.
3. CALL-TO-ACTION: Include a visible CTA element like "Shop Now", "Order Today", "Get Yours", or "Learn More" as text or button.
4. PROFESSIONAL AD LAYOUT: Proper spacing, hierarchy, and typography like a real e-commerce advertisement. This is a DESIGNED marketing creative, not a camera photograph.
5. BRAND FEEL: Clean commercial quality. Think Instagram/Facebook ad, not magazine editorial photo.
6. NO cinematic bokeh, no dramatic shadows, no photojournalism style. This must look like a DESIGNED AD CREATIVE that a brand would run as a paid social media ad.`;

        case 'social_posts':
            return `

CRITICAL REQUIREMENTS — THIS IS AN ORGANIC SOCIAL POST, NOT AN AD:
1. ENGAGING HEADLINE: Bold statement, tip, question, or hook text — NOT a sales headline.
2. NO CTA BUTTONS: No "Shop Now" or sales language. This is community content.
3. FEED-WORTHY AESTHETIC: Clean design that fits naturally in a social media feed.
4. VALUE-FIRST: Tip, insight, or engaging question that sparks comments and saves.
5. PERSONALITY: Show brand personality, not corporate advertising.
6. SHAREABLE: Design something people would share, save, or send to a friend.`;

        case 'product_photo':
            return `

CRITICAL REQUIREMENTS — THIS IS PURE PRODUCT PHOTOGRAPHY:
1. NO TEXT OVERLAYS: Absolutely no text, no headlines, no CTAs, no graphics.
2. PRODUCT ONLY: The product is the sole subject. Clean, sharp, true-to-life colors.
3. STUDIO QUALITY: Professional studio lighting, clean seamless background (white, grey, or contextual).
4. E-COMMERCE READY: Catalog-quality product shot suitable for Amazon, Shopify, or any online store.
5. SHARP FOCUS: Every product detail visible. True-to-life representation.
6. NO DESIGN ELEMENTS: No badges, no icons, no text of any kind. Pure photography.`;

        case 'branding':
            return `

CRITICAL REQUIREMENTS — THIS IS A BRAND IDENTITY VISUAL:
1. BRAND SYSTEM: Show logo, color palette, typography, or brand guidelines visualization.
2. COHESIVE DESIGN: Everything must feel part of one unified brand identity.
3. MOCKUP QUALITY: Professional mockups (stationery, packaging, signage, or digital).
4. NO PRODUCT PHOTOGRAPHY: This is about the BRAND SYSTEM, not individual products.
5. PROFESSIONAL: Brand agency quality. Think design portfolio presentation.`;

        case 'memes':
            return `

CRITICAL REQUIREMENTS — THIS IS A MEME / VIRAL CONTENT:
1. HUMOR FIRST: The image must be FUNNY above all else. Humor drives virality.
2. BOLD IMPACT TEXT: Classic meme format with bold readable text (top/bottom or integrated).
3. RELATABLE SCENARIO: Exaggerated everyday situation or trending meme format.
4. SHAREABLE: Design something people immediately want to share, tag friends, or repost.
5. MEME NATIVE: This should feel like it belongs on Reddit, Twitter, or meme pages — NOT polished.
6. NO PRODUCT: No product placement or sales messaging. Pure entertainment.`;

        case 'educational':
            return `

CRITICAL REQUIREMENTS — THIS IS AN EDUCATIONAL INFOGRAPHIC:
1. CLEAR HIERARCHY: Title, numbered sections/steps, and visual flow must be immediately clear.
2. CLEAN DATA VISUALIZATION: Use icons, numbered lists, or step-by-step layouts.
3. READABLE TYPOGRAPHY: Clean sans-serif text that's easy to read at any size.
4. MINIMAL DECORATION: Information-density over decoration. Every element serves a purpose.
5. SAVE-WORTHY: Design something people pin, save, or screenshot for reference.
6. NO SALES: Pure education and information. No CTAs, no product pushing.`;

        case 'event':
            return `

CRITICAL REQUIREMENTS — THIS IS AN EVENT/PROMO GRAPHIC:
1. DATE AND TIME PROMINENT: The event date, time, and/or location must be clearly visible and large.
2. BOLD HEADLINE: Event name or announcement headline dominates the design.
3. URGENCY ELEMENTS: Countdown, limited spots, or exclusive access feel.
4. CTA: Clear call-to-action like "Register Now", "Save the Date", "RSVP".
5. VIBRANT DESIGN: Eye-catching colors, gradients, or bold shapes that convey excitement.
6. EVENT BANNER QUALITY: Professional event marketing design.`;

        case 'testimonial':
            return `

CRITICAL REQUIREMENTS — THIS IS A TESTIMONIAL/REVIEW CARD:
1. CUSTOMER QUOTE: Large quoted testimonial text is the centerpiece.
2. STAR RATING: Include a 5-star rating visual element.
3. CUSTOMER ATTRIBUTION: Name/initials placeholder with the quote.
4. TRUST DESIGN: Clean professional layout that builds credibility.
5. NO PRODUCT PUSH: Focus on human voice and social proof, not sales.`;

        case 'stories':
            return `

CRITICAL REQUIREMENTS — THIS IS A STORY/REEL FORMAT:
1. VERTICAL FORMAT: Designed for 9:16 vertical consumption (Stories, Reels, Shorts).
2. BOLD TEXT: Large, readable text that works even at small phone sizes.
3. SWIPE-UP / LINK CTA: Include interactive story elements.
4. FAST-PACED FEEL: Design that suggests motion, urgency, or sequence.
5. PLATFORM NATIVE: Must feel like it belongs in Instagram/TikTok Stories.`;

        case 'email':
            return `

CRITICAL REQUIREMENTS — THIS IS AN EMAIL HEADER/HERO:
1. EMAIL-OPTIMIZED: Designed at standard email widths (600px).
2. BOLD HERO IMAGE: Eye-catching header that works in email clients.
3. CLEAR CTA: Prominent button or link-style call-to-action.
4. BRAND CONSISTENT: Professional email marketing design quality.
5. LIGHT FILE SIZE: Optimized for fast email loading.`;

        case 'thumbnails':
            return `

CRITICAL REQUIREMENTS — THIS IS A VIDEO THUMBNAIL:
1. CLICK-WORTHY: Designed to maximize click-through rate on YouTube/social.
2. BOLD TEXT: 3-5 words max, large and readable even at small sizes.
3. EXPRESSIVE FACE: If applicable, include an expressive human face element.
4. HIGH CONTRAST: Colors and text that pop against any background.
5. NO CLUTTER: Clean, focused design with one clear focal point.`;

        default:
            return '';
    }
}

/**
 * Determine the best photography style based on niche scenarios and content type.
 */
function selectPhotoStyle(niche, contentType) {
    const scenarios = niche?.visual_direction?.scenarios || [];
    const scenarioStr = scenarios.join(' ').toLowerCase();

    // Graphic/design-heavy content
    if (scenarioStr.includes('card') || scenarioStr.includes('checklist') ||
        scenarioStr.includes('infographic') || scenarioStr.includes('quiz') ||
        scenarioStr.includes('bingo') || scenarioStr.includes('challenge')) {
        return 'graphic';
    }

    // Flat-lay style
    if (scenarioStr.includes('flat-lay') || scenarioStr.includes('grid') ||
        scenarioStr.includes('setup') || scenarioStr.includes('shelfie')) {
        return 'flat_lay';
    }

    // Lifestyle
    if (scenarioStr.includes('lifestyle') || scenarioStr.includes('routine') ||
        scenarioStr.includes('moment') || contentType === 'video') {
        return 'lifestyle';
    }

    // Default: graphic for social posts since most are designed cards
    return 'graphic';
}

/**
 * assemblePrompt — Enhanced with platform-specific technical direction.
 * Given a prompt config, niche key, platform, content type, title, and description,
 * it assembles the full enriched prompt with photography-grade technical direction.
 */
export function assemblePrompt(config, nicheKey, platform, contentType, title, description, category, businessContext) {
    if (!config) return `Design a professional social media visual for ${title}. ${description}.`;

    const niche = config.niches?.[nicheKey] || config.niches?.general;
    if (!niche) return `Design a professional social media visual for ${title}. ${description}.`;

    // Step 1: Select base prompt by content type
    let basePrompt = '';
    switch (contentType) {
        case 'video':
            if (niche.video_prompts?.length > 0) {
                basePrompt = niche.video_prompts[Math.floor(Math.random() * niche.video_prompts.length)];
            } else {
                basePrompt = niche.video_prompt || '';
            }
            break;
        case 'carousel':
            basePrompt = niche.carousel_prompt || '';
            break;
        case 'caption':
            if (niche.caption_templates?.length > 0) {
                basePrompt = niche.caption_templates[Math.floor(Math.random() * niche.caption_templates.length)];
            } else {
                basePrompt = `Write a short punchy caption for ${title}. ${description}.`;
            }
            // For captions, return early (no enrichment)
            return renderTemplate(basePrompt, title, description, businessContext);
        default: // image
            if (niche.master_prompts?.length > 0) {
                basePrompt = niche.master_prompts[Math.floor(Math.random() * niche.master_prompts.length)];
            } else {
                basePrompt = niche.master_prompt || '';
            }
            break;
    }

    // Fallback to master prompt
    if (!basePrompt) {
        if (niche.master_prompts?.length > 0) {
            basePrompt = niche.master_prompts[Math.floor(Math.random() * niche.master_prompts.length)];
        } else {
            basePrompt = niche.master_prompt || '';
        }
    }

    // Step 2: Render template variables
    basePrompt = renderTemplate(basePrompt, title, description, businessContext);

    // Step 3: Platform-specific aspect ratio & format directive
    const platformKey = normalizePlatform(platform);
    const cfgKey = platformConfigKey(platform);
    const mediaType = contentType === 'video' ? 'video' : (contentType === 'carousel' ? 'carousel' : 'image');
    const aspectRatio = PLATFORM_ASPECT_RATIOS[platformKey]?.[mediaType] || '1:1 square (1080×1080px)';

    let formatBlock = `\n\nFORMAT & DIMENSIONS:\n- Aspect ratio: ${aspectRatio}\n- Design MUST fill the entire canvas — no letterboxing or empty margins`;

    // Step 4: Platform-native style directive
    const styleDirective = PLATFORM_STYLE_DIRECTIVES[platformKey] || '';
    if (styleDirective) {
        formatBlock += `\n\n${styleDirective}`;
    }

    // Step 5: Platform adaptation from niche config + platform creative rules
    let platformBlock = '';

    // Check both the specific platform key and the meta fallback for adaptation
    const adaptation = niche.platform_adaptation?.[platformKey] || niche.platform_adaptation?.[cfgKey];
    if (adaptation) {
        platformBlock += `\n\nPLATFORM-SPECIFIC DIRECTION:\n${adaptation}`;
    }

    const platformConfig = config.platforms?.[platformKey] || config.platforms?.[cfgKey];
    if (platformConfig) {
        if (platformConfig.best_ad_frameworks?.length > 0) {
            platformBlock += `\n\nCONTENT FRAMEWORK: ${platformConfig.best_ad_frameworks.join(' or ')}`;
        }
        platformBlock += `\n\nPLATFORM CREATIVE RULES:\n${platformConfig.creative_rules || ''}`;
    }

    // Step 6: Visual direction from niche config
    let visualBlock = '\n\nVISUAL DIRECTION:\n';
    visualBlock += `- Lighting: ${niche.visual_direction?.lighting || 'standard'}\n`;
    visualBlock += `- Color palette: ${(niche.visual_direction?.colors || []).join(', ')}\n`;
    visualBlock += `- Product rule: ${niche.product_rule || ''}`;

    // Step 7: Photography / design technical direction
    const photoStyle = selectPhotoStyle(niche, contentType);
    const techBlock = PHOTOGRAPHY_TECHNICAL[photoStyle] || '';

    // Step 8: Category instruction
    const catInstruction = categoryInstruction(category);

    // Step 9: Anti-artifact quality requirements
    const qualityBlock = ANTI_ARTIFACT;

    // Step 10: Brand identity (if business context provided)
    const brandBlock = buildBrandBlock(businessContext);

    // Step 11: Assemble the full enriched prompt
    return basePrompt + formatBlock + platformBlock + visualBlock +
        (techBlock ? '\n\n' + techBlock : '') + catInstruction + brandBlock + qualityBlock;
}

/**
 * assembleAllPrompts — Returns ALL prompt variants for the resolved niche (not just one random pick).
 * Each variant is fully enriched with platform direction, visual direction, photography tech, and anti-artifact.
 * Returns an array of { index, label, prompt } objects.
 */
export function assembleAllPrompts(config, nicheKey, platform, contentType, title, description, category, businessContext) {
    if (!config) return [{ index: 0, label: 'Default', prompt: `Design a professional social media visual for ${title}. ${description}.` }];

    const niche = config.niches?.[nicheKey] || config.niches?.general;
    if (!niche) return [{ index: 0, label: 'Default', prompt: `Design a professional social media visual for ${title}. ${description}.` }];

    // Determine which prompt array to use based on content type
    let rawPrompts = [];
    switch (contentType) {
        case 'video':
            rawPrompts = (niche.video_prompts?.length > 0 ? niche.video_prompts : [niche.video_prompt || '']).filter(Boolean);
            break;
        case 'carousel':
            rawPrompts = [niche.carousel_prompt].filter(Boolean);
            break;
        case 'caption':
            rawPrompts = (niche.caption_templates?.length > 0 ? niche.caption_templates : []).filter(Boolean);
            // For captions, return early without enrichment
            return rawPrompts.map((p, i) => ({
                index: i,
                label: `Caption ${i + 1}`,
                prompt: renderTemplate(p, title, description, businessContext),
            }));
        default: // image
            rawPrompts = (niche.master_prompts?.length > 0 ? niche.master_prompts : [niche.master_prompt || '']).filter(Boolean);
            break;
    }

    if (rawPrompts.length === 0) {
        rawPrompts = (niche.master_prompts?.length > 0 ? niche.master_prompts : [niche.master_prompt || '']).filter(Boolean);
    }

    // Build enrichment blocks (same for all variants)
    const platformKey = normalizePlatform(platform);
    const cfgKey = platformConfigKey(platform);
    const mediaType = contentType === 'video' ? 'video' : (contentType === 'carousel' ? 'carousel' : 'image');
    const aspectRatio = PLATFORM_ASPECT_RATIOS[platformKey]?.[mediaType] || '1:1 square (1080×1080px)';

    let formatBlock = `\n\nFORMAT & DIMENSIONS:\n- Aspect ratio: ${aspectRatio}\n- Design MUST fill the entire canvas — no letterboxing or empty margins`;

    const styleDirective = PLATFORM_STYLE_DIRECTIVES[platformKey] || '';
    if (styleDirective) formatBlock += `\n\n${styleDirective}`;

    let platformBlock = '';
    const adaptation = niche.platform_adaptation?.[platformKey] || niche.platform_adaptation?.[cfgKey];
    if (adaptation) platformBlock += `\n\nPLATFORM-SPECIFIC DIRECTION:\n${adaptation}`;

    const platformConfig = config.platforms?.[platformKey] || config.platforms?.[cfgKey];
    if (platformConfig) {
        if (platformConfig.best_ad_frameworks?.length > 0)
            platformBlock += `\n\nCONTENT FRAMEWORK: ${platformConfig.best_ad_frameworks.join(' or ')}`;
        platformBlock += `\n\nPLATFORM CREATIVE RULES:\n${platformConfig.creative_rules || ''}`;
    }

    let visualBlock = '\n\nVISUAL DIRECTION:\n';
    visualBlock += `- Lighting: ${niche.visual_direction?.lighting || 'standard'}\n`;
    visualBlock += `- Color palette: ${(niche.visual_direction?.colors || []).join(', ')}\n`;
    visualBlock += `- Product rule: ${niche.product_rule || ''}`;

    const photoStyle = selectPhotoStyle(niche, contentType);
    const techBlock = PHOTOGRAPHY_TECHNICAL[photoStyle] || '';
    const catInstruction = categoryInstruction(category);
    const qualityBlock = ANTI_ARTIFACT;

    const enrichmentSuffix = formatBlock + platformBlock + visualBlock +
        (techBlock ? '\n\n' + techBlock : '') + catInstruction + buildBrandBlock(businessContext) + qualityBlock;

    // Label extraction: try to pull a short label from the prompt text
    function extractLabel(prompt, index) {
        // Try to extract the ad type from the prompt (e.g., "BEFORE/AFTER TRANSFORMATION AD", "SOCIAL PROOF AD")
        const match = prompt.match(/(?:Design\s+(?:a|an)\s+)([A-Z][A-Z\s/\-]+(?:AD|STYLE|FORMAT|MOMENT|HERO|KIT|SPOTLIGHT|ROUTINE|STACK|PROOF|URGENCY|SALE|DROP|COMPARISON|REVIEW|BUNDLE|RESULT|EDGE|OUTCOME|TRUST))/i);
        if (match) return match[1].trim().replace(/\s+AD$/i, '').replace(/\s+/g, ' ');
        // Fallback
        const typeLabels = { video: 'Video', carousel: 'Carousel', caption: 'Caption' };
        return `${typeLabels[contentType] || 'Prompt'} ${index + 1}`;
    }

    return rawPrompts.map((raw, i) => {
        const rendered = renderTemplate(raw, title, description, businessContext);
        return {
            index: i,
            label: extractLabel(raw, i),
            prompt: rendered + enrichmentSuffix,
        };
    });
}

/**
 * getNicheKeys returns all niche keys from a prompt config.
 */
export function getNicheKeys(config) {
    return Object.keys(config?.niches || {});
}

// ── Carousel Frameworks ─────────────────────────────────────────────
// Winning carousel slide structures per niche category.
// Each framework defines per-slide prompts that share a visual design system.
// Slide prompts use {{.Title}}, {{.Description}} variables.

const CAROUSEL_FRAMEWORKS = {
    // ── E-COMMERCE / PRODUCT NICHES ──
    home_organization: [
        {
            model: 'Hook → Transformation → Benefits → Proof → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Bold attention-grabbing hook headline: "Your Home Deserves Better". Product hero shot on a clean beige background with soft shadow. Large modern sans-serif typography. {{ .Description }}. Minimal, premium ad design.' },
                { role: 'transformation', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Dramatic BEFORE/AFTER split: left side shows a cluttered, messy, chaotic space in flat unflattering light. Right side shows the same space perfectly organized with the product, bright and clean. Bold text: "The Transformation Is Real". {{ .Description }}.' },
                { role: 'benefits', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Three key benefit icons on a clean beige background: "Saves 2 Hours/Week" with clock icon, "Fits Any Space" with home icon, "Premium Quality" with star icon. Clean layout, modern typography. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Social proof layout: large 5-star rating, bold "10,000+ Happy Homes", three mini customer quote testimonials. Product small at bottom. Trustworthy clean layout. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Bold CTA card: product hero, current price prominent, "Shop Now" button, urgency line "Limited Stock". Clean beige background, premium minimal design. {{ .Description }}.' },
            ],
        },
        {
            model: 'Problem → Agitate → Solution → Results → Offer',
            slides: [
                { role: 'problem', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Relatable problem: frustrated person surrounded by clutter and mess. Bold red text: "Tired of the Mess?". Dark/moody lighting to emphasize frustration. {{ .Description }}.' },
                { role: 'agitate', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Agitate the problem: statistics overlay — "The average person wastes 2.5 hours/week looking for things". Messy desk/closet background. Bold serif headline. {{ .Description }}.' },
                { role: 'solution', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. The solution: product hero on bright clean background. Bold green text: "Fixed in 5 Minutes". Product features highlighted with clean icons. {{ .Description }}.' },
                { role: 'results', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Customer results: beautifully organized space photo, overlay with 5-star rating quote: "This completely changed my home". {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Offer card: "48-Hour Flash Sale" banner, product with price, "Shop Now" CTA button, countdown timer graphic. {{ .Description }}.' },
            ],
        },
        {
            model: 'Product Deep-Dive (3-slide compact)',
            slides: [
                { role: 'hero', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Stunning product hero shot: product on clean beige surface with dramatic shadow, bold headline "The Organization Upgrade You Deserve". Premium ad layout. {{ .Description }}.' },
                { role: 'features', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Feature breakdown: product from different angle with three callout arrows pointing to key features. Clean infographic-style layout on white background. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 3 (final slide) of a carousel ad for {{ .Title }}. Conversion card: product, price, 5-star rating, "Join 10K+ Happy Customers" social proof line, large "Shop Now" CTA button. {{ .Description }}.' },
            ],
        },
    ],
    beauty_skincare: [
        {
            model: 'Hook → Ingredient → Before/After → Reviews → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Elegant beauty hook: product hero with dewy lighting on pastel pink/lavender background. Bold headline "Your Skin Deserves This". Luxury serif typography. {{ .Description }}.' },
                { role: 'ingredient', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Ingredient spotlight: key active ingredient (e.g., hyaluronic acid, retinol) with visual representation, benefit text "Clinically Proven Results". Soft editorial layout. {{ .Description }}.' },
                { role: 'results', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Before/after skin transformation: realistic close-up showing improvement. Text "Real Results in 30 Days". Clean clinical layout. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Reviews montage: 5-star rating, "4.9/5 from 5,000+ Reviews", three customer quote snippets with mini avatars. Pastel lavender background. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Beauty CTA: product lineup/bundle, "Glow Season Sale" offer with price, "Claim Your Glow" CTA button. Luxury pastel design. {{ .Description }}.' },
            ],
        },
        {
            model: 'Routine Builder (3-Slide)',
            slides: [
                { role: 'step1', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Step 1 of routine: "CLEANSE" — product with water splash effect, soft dewy lighting, elegant numbering "01", pastel background. {{ .Description }}.' },
                { role: 'step2', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Step 2 of routine: "TREAT" — product with active ingredient visuals, bold benefit text, elegant "02", matching pastel design. {{ .Description }}.' },
                { role: 'step3', prompt: 'Design SLIDE 3 (final slide) of a carousel ad for {{ .Title }}. Step 3 of routine: "GLOW" — final result, radiant skin visual, "Complete Your Routine — Shop Now" CTA, price, elegant "03". {{ .Description }}.' },
            ],
        },
    ],
    fitness: [
        {
            model: 'Hook → Stats → Transformation → Proof → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Bold fitness hook: product on matte dark background with dramatic rim lighting. Bold Impact text "Built for Results". Dark premium aesthetic like Nike. {{ .Description }}.' },
                { role: 'stats', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Performance stats: three bold stat badges "+47% Performance", "2X Faster Recovery", "#1 Rated" on dark matte background. Large bold numbers. {{ .Description }}.' },
                { role: 'transformation', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Transformation showcase: before/after athletic result. Bold text "See the Difference". Dark dramatic lighting. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Social proof: athlete testimonial with 5-star rating quote on dark background. "Trusted by 50K+ Athletes". Bold minimal layout. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. CTA card: product hero on dark background, price, "Get the Full Kit — Save 35%" offer, bold "Shop Now" CTA button. Premium fitness brand. {{ .Description }}.' },
            ],
        },
    ],
    tech_gadgets: [
        {
            model: 'Hook → Feature → Comparison → Reviews → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Tech hook: product on ultra-dark background with neon accent lighting. Bold headline "The Smart Upgrade". Futuristic sans-serif typography. {{ .Description }}.' },
                { role: 'feature', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Feature close-up: macro shot of product detail with spec callouts and text overlays. Clean infographic style on dark background. {{ .Description }}.' },
                { role: 'comparison', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Comparison chart: {{ .Title }} vs competitor side by side. Checkmarks for winning features. Clean dark table layout. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Expert reviews: tech publication logos, star rating, "Editor\'s Choice" badge. Quote from expert review. Dark premium layout. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Tech CTA: product hero, price, "Order Now" button, free shipping badge. Dark premium design with neon accents. {{ .Description }}.' },
            ],
        },
    ],
    pets: [
        {
            model: 'Hook → Trust → Results → Reviews → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Pet care hook: happy dog/cat with product, warm cozy lighting. Bold text "Because They Deserve the Best". Warm cream background. {{ .Description }}.' },
                { role: 'trust', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Trust badges: "Vet Recommended", "100% Natural", "Made in USA" badges with paw print icons. Warm clean layout. {{ .Description }}.' },
                { role: 'results', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Before/after pet result: healthier coat/happier pet. Bold text "Real Results Pet Parents Love". Warm golden lighting. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Pet parent reviews: 5-star rating, "Loved by 10K+ Pet Parents", customer quotes with pet photos. Warm design. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. CTA: product with price, "Your Fur Baby Will Thank You" headline, "Shop Now" button. Warm cream background with paw prints. {{ .Description }}.' },
            ],
        },
    ],
    fashion_apparel: [
        {
            model: 'Hero → Detail → Styled → Colors → CTA',
            slides: [
                { role: 'hero', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Fashion hero: product "Just Dropped" announcement on clean neutral background. Editorial lighting, minimalist typography. {{ .Description }}.' },
                { role: 'detail', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Texture close-up: macro detail of fabric quality, stitching, materials. "Premium Quality, Every Detail". Editorial fashion layout. {{ .Description }}.' },
                { role: 'styled', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Styled outfit: product in a complete outfit formula with complementary pieces. "How to Style It". Fashion editorial. {{ .Description }}.' },
                { role: 'colors', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Color variants: product shown in 3-4 available colors as swatches/mini cards. "Pick Your Color". Clean fashion layout. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Fashion CTA: product hero, price, "Claim Your Style" button, "Free Returns" badge. Clean editorial design. {{ .Description }}.' },
            ],
        },
    ],
    food_beverage: [
        {
            model: 'Hero → Ingredients → Nutrition → Reviews → CTA',
            slides: [
                { role: 'hero', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Appetizing hero: product styled beautifully with warm golden lighting, bold "Taste the Difference" headline. Warm inviting design. {{ .Description }}.' },
                { role: 'ingredients', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Ingredient transparency: key ingredients artfully displayed around product. "Made with Real Ingredients". Clean warm layout. {{ .Description }}.' },
                { role: 'nutrition', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Nutrition comparison: {{ .Title }} vs competitor nutrition facts side by side. Winning stats highlighted. Clean infographic. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Taste reviews: 5-star rating, "Best Taste Award" badge, customer quotes about flavor. Warm appetizing design. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Food CTA: product hero with appetizing styling, price, "Order Now" button, free shipping badge. Warm design. {{ .Description }}.' },
            ],
        },
    ],
    health_wellness: [
        {
            model: 'Hook → Clinical → Results → Trust → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Wellness hook: product on clean white background with sage green accents. Bold "Clinically Proven Results" headline. Clean medical-grade design. {{ .Description }}.' },
                { role: 'clinical', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Clinical evidence: bold stat "89% Saw Improvement in 30 Days" with clinical study citation badge. Clean white/sage layout. {{ .Description }}.' },
                { role: 'ingredients', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Ingredient transparency: key active ingredients with dosages and benefits. "Science-Backed Formula". Clean medical design. {{ .Description }}.' },
                { role: 'trust', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Trust: "Doctor Recommended" badge, customer transformation quotes, 5-star rating. Clean green/white layout. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Wellness CTA: product, price, "Invest in Your Health" headline, "Shop Now" button. Clean sage green design. {{ .Description }}.' },
            ],
        },
    ],
    supplements: [
        {
            model: 'Hook → Science → Stack → Proof → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Supplement hook: product bottle with dramatic lighting on dark background. Bold "Backed by Science" headline. Premium clean design. {{ .Description }}.' },
                { role: 'science', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Science breakdown: ingredient label transparency with dosages highlighted, "Third-Party Tested" badge. Clean clinical layout. {{ .Description }}.' },
                { role: 'stack', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Morning/evening routine: products arranged in daily routine layout. "Your Complete Daily Stack". Clean organized design. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Clinical proof: "94% of Users Reported Results in 30 Days", customer before/after, star rating. Evidence-based design. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Supplement CTA: product, "Subscribe & Save 25%" offer, "Start Your Stack" button, free shipping badge. Premium design. {{ .Description }}.' },
            ],
        },
    ],
    baby_kids: [
        {
            model: 'Hook → Safety → Adorable → Reviews → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Baby product hook: product on soft pastel background. Bold gentle headline "Safe. Tested. Loved." Soft warm lighting. {{ .Description }}.' },
                { role: 'safety', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Safety certifications: "Pediatrician Approved", "100% Non-Toxic", "BPA Free" badges on pastel background. Gentle trustworthy layout. {{ .Description }}.' },
                { role: 'adorable', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Adorable moment: product in use, happy baby/toddler scene. Warm soft lighting, gentle pastel palette. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Parent reviews: 5-star rating, "Loved by 10K+ Parents", gentle customer quotes. Soft pastel design. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Baby CTA: product, price, "Give Them the Best" headline, "Shop Now" button. Gentle pastel design. {{ .Description }}.' },
            ],
        },
    ],
    automotive: [
        {
            model: 'Hook → Specs → Install → Reviews → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Auto hook: product on dark dramatic background with chrome accents. Bold "Unlock Performance" headline. Premium automotive ad. {{ .Description }}.' },
                { role: 'specs', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Spec comparison: before/after performance stats with bold numbers. "See the Difference" on dark background. {{ .Description }}.' },
                { role: 'install', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Install showcase: product being installed/fitted, "Easy 10-Minute Install" text. Clean dark automotive layout. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Driver reviews: 5-star rating, enthusiast testimonials, "Trusted by 10K+ Drivers". Dark premium layout. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Auto CTA: product, price, "Gear Up Now" button, free shipping badge. Dark dramatic automotive design. {{ .Description }}.' },
            ],
        },
    ],
    garden_outdoor: [
        {
            model: 'Hook → Growth → Benefits → Reviews → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Garden hook: product surrounded by lush greenery with natural golden-hour lighting. Bold "Watch Your Garden Thrive". Natural green design. {{ .Description }}.' },
                { role: 'growth', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Before/after growth result: side by side garden transformation. "Results in Just 2 Weeks". Natural earthy layout. {{ .Description }}.' },
                { role: 'benefits', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Key benefits: "100% Organic", "Safe for Pets & Kids", "Long-Lasting" with nature icons. Clean green layout. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Gardener reviews: 5-star rating, "Loved by 5K+ Gardeners", green-thumb testimonials. Natural warm design. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Garden CTA: product, seasonal offer price, "Grow Your Best Garden" button. Natural green design. {{ .Description }}.' },
            ],
        },
    ],
    sports: [
        {
            model: 'Hook → Performance → Action → Proof → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Sports hook: product with dynamic energy on dark background. Bold "Perform When It Matters" headline. Athletic brand energy. {{ .Description }}.' },
                { role: 'performance', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Performance features: specs and technology breakdown with bold numbers. Dynamic athletic layout. {{ .Description }}.' },
                { role: 'action', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Action context: product in athletic use, frozen motion shot. Dynamic energy, bold contrast. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Athlete proof: 5-star rating, athlete testimonials, "Trusted by Champions" badge. Dynamic sports design. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Sports CTA: product, "Game Day Sale" offer, "Gear Up" button. Bold dynamic design. {{ .Description }}.' },
            ],
        },
    ],
    education_learning: [
        {
            model: 'Hook → Curriculum → Instructor → Results → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Education hook: bold "Invest in Yourself" on clean navy/white background. Course hero visual. Professional design. {{ .Description }}.' },
                { role: 'curriculum', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Curriculum highlights: key modules/topics listed with progress icons. "Complete Learning Path" header. Clean professional layout. {{ .Description }}.' },
                { role: 'instructor', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Instructor credentials: expert profile with qualifications, "Learn from the Best" headline. Professional design. {{ .Description }}.' },
                { role: 'results', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Student results: "94% Career Growth", "25,000+ Enrolled", 5-star rating. Success story quotes. Professional design. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. Education CTA: course/product, enrollment price, "Get Full Access" button, money-back guarantee badge. Professional design. {{ .Description }}.' },
            ],
        },
    ],
    general: [
        {
            model: 'Hook → Features → Proof → Offer → CTA',
            slides: [
                { role: 'hook', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Bold product hero on clean background with strong headline text that stops the scroll. Modern sans-serif typography. {{ .Description }}.' },
                { role: 'features', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. Key feature highlight: product from different angle with three benefit callout badges. Clean infographic style. {{ .Description }}.' },
                { role: 'proof', prompt: 'Design SLIDE 3 of a carousel ad for {{ .Title }}. Social proof: 5-star rating, review count, customer testimonial quote. Trust-building layout. {{ .Description }}.' },
                { role: 'offer', prompt: 'Design SLIDE 4 of a carousel ad for {{ .Title }}. Comparison vs alternatives: side-by-side showing why {{ .Title }} wins. Clean comparison layout. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 5 (final slide) of a carousel ad for {{ .Title }}. CTA card: product hero, price, "Shop Now" button, satisfaction guarantee badge. Professional clean design. {{ .Description }}.' },
            ],
        },
        {
            model: 'Problem → Solution → Benefits (3-Slide)',
            slides: [
                { role: 'problem', prompt: 'Design SLIDE 1 of a carousel ad for {{ .Title }}. Bold problem statement that resonates with target audience. Attention-grabbing visual with bold red/orange text. {{ .Description }}.' },
                { role: 'solution', prompt: 'Design SLIDE 2 of a carousel ad for {{ .Title }}. The solution: product hero as the answer, key benefits listed with icons. Clean, positive design. {{ .Description }}.' },
                { role: 'cta', prompt: 'Design SLIDE 3 (final slide) of a carousel ad for {{ .Title }}. Conversion card: product, price, social proof, "Shop Now" CTA button. Professional ad layout. {{ .Description }}.' },
            ],
        },
    ],
};

/**
 * assembleCarouselSlides — Generates N per-slide prompts for a carousel ad.
 * All slides share the same design system (niche visual direction + platform format)
 * to ensure visual consistency across the entire carousel.
 *
 * @param {object} config - Prompt config (from JSON file)
 * @param {string} nicheKey - Resolved niche key
 * @param {string} platform - Target platform
 * @param {number} slideCount - Number of slides to generate (3, 5, or 10)
 * @param {string} title - Product title
 * @param {string} description - Product description
 * @param {string} category - Category key
 * @param {object} businessContext - Optional business context
 * @returns {{ model: string, slides: Array<{ role: string, label: string, prompt: string }> }}
 */
export function assembleCarouselSlides(config, nicheKey, platform, slideCount, title, description, category, businessContext) {
    const niche = config?.niches?.[nicheKey] || config?.niches?.general;

    // Pick the best carousel framework for this niche
    const nicheFrameworks = CAROUSEL_FRAMEWORKS[nicheKey] || CAROUSEL_FRAMEWORKS.general;
    // Pick framework that best matches the requested slide count
    let framework = nicheFrameworks.find(f => f.slides.length === slideCount)
        || nicheFrameworks.find(f => f.slides.length <= slideCount)
        || nicheFrameworks[0];

    // Build slides — if fewer slides than requested, cycle; if more, trim
    let rawSlides = [...framework.slides];
    if (rawSlides.length < slideCount) {
        // For extra slides beyond the framework, duplicate from secondary frameworks or repeat with variation
        const extraFrameworks = nicheFrameworks.filter(f => f !== framework);
        for (const ef of extraFrameworks) {
            if (rawSlides.length >= slideCount) break;
            for (const s of ef.slides) {
                if (rawSlides.length >= slideCount) break;
                // Skip if we already have this role
                if (!rawSlides.find(r => r.role === s.role)) {
                    rawSlides.push(s);
                }
            }
        }
        // If still short, add generic variants
        while (rawSlides.length < slideCount) {
            const idx = rawSlides.length;
            rawSlides.push({
                role: `extra_${idx}`,
                prompt: `Design SLIDE ${idx + 1} of a carousel ad for {{ .Title }}. Additional product angle or benefit highlight. Consistent design language. {{ .Description }}.`,
            });
        }
    }
    rawSlides = rawSlides.slice(0, slideCount);

    // Build the shared design system block (applied to ALL slides for consistency)
    const platformKey = normalizePlatform(platform);
    const aspectRatio = PLATFORM_ASPECT_RATIOS[platformKey]?.carousel || '4:5 portrait (1080×1350px)';

    let designSystem = `\n\nDESIGN CONSISTENCY (CRITICAL — apply these exact same rules to EVERY slide in this carousel):`;
    designSystem += `\n- Aspect ratio: ${aspectRatio} — EVERY slide MUST use this exact format`;
    designSystem += `\n- This is SLIDE {{SLIDE_NUM}} of ${slideCount} in a cohesive carousel — ALL slides must look like they belong to the same campaign`;
    designSystem += `\n- Use the EXACT SAME color palette, typography, layout grid, and design elements across all slides`;
    designSystem += `\n- Maintain consistent margins, padding, text positioning, and visual weight`;

    if (niche?.visual_direction) {
        designSystem += `\n- Lighting: ${niche.visual_direction.lighting || 'professional studio lighting'}`;
        designSystem += `\n- Color palette: ${(niche.visual_direction.colors || []).join(', ')} — use ONLY these colors across all slides`;
    }

    if (niche?.product_rule) {
        designSystem += `\n- Product rule: ${niche.product_rule}`;
    }

    // Platform style
    const styleDirective = PLATFORM_STYLE_DIRECTIVES[platformKey] || '';
    if (styleDirective) designSystem += `\n\n${styleDirective}`;

    // Brand identity
    const brandBlock = buildBrandBlock(businessContext);

    // Anti-artifact
    const qualityBlock = ANTI_ARTIFACT;

    // Assemble each slide with shared design system
    const slides = rawSlides.map((slide, idx) => {
        let slidePrompt = renderTemplate(slide.prompt, title, description, businessContext);
        // Inject slide number into design system
        const slideDesign = designSystem.replace('{{SLIDE_NUM}}', String(idx + 1));
        const fullPrompt = slidePrompt + slideDesign + brandBlock + qualityBlock;

        return {
            index: idx,
            role: slide.role,
            label: `Slide ${idx + 1}: ${slide.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
            prompt: fullPrompt,
        };
    });

    return {
        model: framework.model,
        slideCount: slides.length,
        slides,
    };
}
