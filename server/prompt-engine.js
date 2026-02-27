/**
 * prompt-engine.js
 * JavaScript port of the Go SelectPrompt / classifyNiche / normalizePlatform logic.
 * Enhanced with platform-specific technical direction, photography-grade prompt enrichment,
 * and anti-artifact negative prompting for professional AI image generation.
 */

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

/**
 * Replace Go template variables {{ .Title }} and {{ .Description }} with actual values.
 */
export function renderTemplate(text, title, description, businessContext) {
    if (!text) return '';
    let result = text
        .replace(/\{\{\s*\.Title\s*\}\}/g, title || '')
        .replace(/\{\{\s*\.Description\s*\}\}/g, description || '');

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
