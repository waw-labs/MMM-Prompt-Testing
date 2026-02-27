/**
 * winning-templates.js
 * Research-backed template frameworks for high-converting ad/content creatives.
 * Uses proven frameworks from top-performing ads across platforms.
 */

// Cached templates per category+niche combo
const templateCache = new Map();

/**
 * Returns proven high-converting template frameworks for a given category.
 * These are based on documented advertising frameworks and viral content patterns.
 */
export function getWinningTemplates(category) {
    const cacheKey = category;
    if (templateCache.has(cacheKey)) return templateCache.get(cacheKey);

    const templates = TEMPLATES[category] || TEMPLATES.default;
    templateCache.set(cacheKey, templates);
    return templates;
}

const TEMPLATES = {
    ads: [
        {
            name: 'Problem-Agitate-Solve (PAS)',
            structure: 'Hook with the PAIN POINT → Agitate by showing consequences → Present the product as the SOLUTION',
            visual: 'Split design: dark/chaotic left side (problem) vs clean/bright right side (solution with product)',
            cta: 'Strong urgency CTA: "Fix it now", "Stop struggling", "Get relief today"',
        },
        {
            name: 'Before/After Transformation',
            structure: 'Show the BEFORE state (messy, old, painful) → Arrow/divider → AFTER state (clean, new, happy) with product',
            visual: 'Side-by-side or top-bottom split. Before is muted/grey, After is vibrant/colorful',
            cta: '"See the difference", "Transform yours", "Join X+ happy customers"',
        },
        {
            name: 'Social Proof Stack',
            structure: 'Lead with "X,000+ sold" or "Rated #1" → Product hero shot → 3 mini testimonials or star ratings',
            visual: 'Trust badges, star ratings, real review snippets overlaid on clean product image',
            cta: '"Join the movement", "See why X people switched"',
        },
        {
            name: 'Limited Time Urgency',
            structure: 'BOLD discount/deal headline → Product with price slash → Countdown or "ends tonight" urgency',
            visual: 'Red/orange accent colors, strikethrough prices, countdown timer element, "SALE" badge',
            cta: '"Shop now before it\'s gone", "Last chance", "24hr flash sale"',
        },
        {
            name: 'Feature Callout Grid',
            structure: 'Product center stage → 4-6 feature callouts pointing to product with icons + short text',
            visual: 'Clean product shot with annotated feature arrows/callouts, technical diagram style',
            cta: '"Discover every feature", "See specs", "Built different"',
        },
        {
            name: 'UGC/Testimonial Native',
            structure: 'Looks like a real user post → "OMG this actually works" style headline → Product in natural setting',
            visual: 'Lo-fi, phone screenshot aesthetic, text overlays, real-person POV angle',
            cta: '"Link in bio", "I found it here", "Trust me on this one"',
        },
        {
            name: 'Comparison/VS',
            structure: 'YOUR PRODUCT vs ALTERNATIVE → Side-by-side feature comparison → Clear winner visual',
            visual: 'Two columns: competitor (X marks, red) vs yours (checkmarks, green). Product images for both',
            cta: '"Make the switch", "Why settle?", "Upgrade now"',
        },
        {
            name: 'Unboxing/Lifestyle',
            structure: 'Lifestyle context showing product in use → Aspirational scene → Brand overlay',
            visual: 'Warm natural lighting, product integrated into desirable lifestyle scene (morning routine, workout, cooking)',
            cta: '"Elevate your routine", "This is the one", "Level up"',
        },
        {
            name: 'Founder Story / Behind the Scenes',
            structure: '"I created this because..." → Founder/maker narrative → Product reveal with mission',
            visual: 'Split: founder portrait + product, handwritten-style text, raw/authentic feel',
            cta: '"Support small business", "Our story", "Handmade with love"',
        },
        {
            name: 'Listicle/Reasons Why',
            structure: '"X reasons you need this" → Numbered list with icons → Product as the answer',
            visual: 'Clean numbered list layout, each point with an icon, product image as hero',
            cta: '"Reason enough?", "Get yours", "Which is YOUR reason?"',
        },
    ],

    social_posts: [
        {
            name: 'Hot Take / Controversial Opinion',
            structure: '"Unpopular opinion:" or "Hot take:" → Bold statement → Supporting visual',
            visual: 'Bold text on gradient background, speech bubble style',
        },
        {
            name: 'Tip Carousel',
            structure: '"X tips for..." → Each tip on a slide → Save-worthy hook',
            visual: 'Clean numbered slides, consistent color scheme, icon per tip',
        },
        {
            name: 'Behind the Scenes',
            structure: '"What it looks like vs what it takes" → Raw BTS content',
            visual: 'Split: polished result vs messy process, authentic feel',
        },
        {
            name: 'Myth vs Reality',
            structure: '"Myth: X" (crossed out) → "Reality: Y" (highlighted)',
            visual: 'Two-panel: myth in red/strike-through, reality in green/bold',
        },
        {
            name: 'Question Hook',
            structure: '"Do you make this mistake?" or "Did you know?" → Educational content',
            visual: 'Large question text, curious/intriguing imagery',
        },
        {
            name: 'This or That',
            structure: 'Two options side by side → "Which team are you?"',
            visual: 'Split screen, vibrant colors, poll-style layout',
        },
        {
            name: 'Day in the Life',
            structure: 'Timeline/schedule showing product in daily routine',
            visual: 'Time stamps, lifestyle photos, natural lighting',
        },
        {
            name: 'Data/Stat Hook',
            structure: '"X% of people..." → Surprising statistic → Key insight',
            visual: 'Large bold stat number, minimal background, chart/graph element',
        },
        {
            name: 'Transformation Timeline',
            structure: '"Week 1 → Week 4 → Week 12" → Progress shots',
            visual: 'Timeline layout, progressive improvement, before→after series',
        },
        {
            name: 'User-Generated Repost',
            structure: '"@customer said it best:" → Real review/comment screenshot → Brand response',
            visual: 'Screenshot-style card, quote marks, authentic feel',
        },
    ],

    branding: [
        {
            name: 'Brand Identity System',
            structure: 'Logo + color palette + typography showcase on branded mockups',
            visual: 'Clean white/dark background, organized brand elements grid',
        },
        {
            name: 'Stationery Mockup Suite',
            structure: 'Business card + letterhead + envelope in branded colors',
            visual: 'Flat lay or isometric mockup, consistent branding',
        },
        {
            name: 'Packaging Design Reveal',
            structure: 'Product packaging from multiple angles, unboxing sequence',
            visual: 'Premium packaging shots, custom boxes, tissue paper, inserts',
        },
        {
            name: 'Social Media Brand Kit',
            structure: 'Grid of branded social templates, story templates, profile mockup',
            visual: 'Instagram grid preview, story previews, consistent visual identity',
        },
        {
            name: 'Brand Guidelines Page',
            structure: 'Logo usage rules, color codes, font specimens, do/don\'t examples',
            visual: 'Clean layout, organized sections, professional design system presentation',
        },
    ],

    testimonial: [
        {
            name: 'Customer Spotlight Card',
            structure: '"Customer Name" + star rating + pull quote + product image',
            visual: 'Clean card layout, avatar placeholder, 5-star visual, quotation marks',
        },
        {
            name: 'Before/After Success Story',
            structure: 'Customer journey: pain point → discovery → results with numbers',
            visual: 'Split layout, progress metrics, customer photo space, product integration',
        },
        {
            name: 'Video Testimonial Thumbnail',
            structure: 'Customer face + pull quote + play button overlay',
            visual: 'Real-person feel, speech bubble quote, video play icon',
        },
        {
            name: 'Statistics-Backed Review',
            structure: '"93% of customers agree..." + stat visualization + review excerpt',
            visual: 'Data visualization, percentage circles, trust badges',
        },
        {
            name: 'Social Proof Collage',
            structure: 'Multiple mini-reviews in a grid/collage layout',
            visual: 'Grid of review cards, varied star ratings, diverse names',
        },
    ],

    event: [
        {
            name: 'Launch Event Banner',
            structure: 'Bold event name + date/time + countdown element + RSVP CTA',
            visual: 'Gradient background, bold typography, calendar icon, urgency badge',
        },
        {
            name: 'Flash Sale Countdown',
            structure: 'Countdown timer + deal preview + limited quantity warning',
            visual: 'Timer digits, fire/urgency emojis, product preview, strikethrough price',
        },
        {
            name: 'Webinar/Workshop Promo',
            structure: 'Speaker photo + topic title + key takeaways + register CTA',
            visual: 'Speaker headshot, clean info layout, value bullets, register button',
        },
    ],

    thumbnails: [
        {
            name: 'Shock Face + Bold Text',
            structure: 'Expressive face on one side + 3-5 word bold title on other',
            visual: 'High contrast, bright background, massive text, face with emotion',
        },
        {
            name: 'Comparison Thumbnail',
            structure: 'Product A vs Product B with VS badge in center',
            visual: 'Split screen, VS graphic, both products equal size, contrasting colors',
        },
        {
            name: 'List/Number Thumbnail',
            structure: 'Large number ("7 TIPS") + topic icon + clean background',
            visual: 'Huge number, supporting icon/image, bold sans-serif font',
        },
        {
            name: 'Arrow/Circle Highlight',
            structure: 'Image with red circle/arrow pointing to key detail',
            visual: 'Red hand-drawn circle, arrow pointing, "LOOK AT THIS" energy',
        },
    ],

    default: [
        {
            name: 'Hero Product Shot',
            structure: 'Product front and center, bold headline, clean background',
            visual: 'Studio-quality product photography, minimal design, premium feel',
        },
        {
            name: 'Benefit-Focused Layout',
            structure: '3 key benefits with icons around central product image',
            visual: 'Icon + text callouts, clean spacing, product as focal point',
        },
    ],
};
