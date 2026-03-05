// ── State ────────────────────────────────────────────────────────────
let promptConfigs = {};
let selectedProvider = 'gemini';
let assembledResults = [];
let selectedPromptIndex = -1;
let uploadedImageBase64 = null; // base64 data URI of uploaded product image

const CATEGORY_LABELS = {
    ads: 'Ads',
    social_posts: 'Social Posts',
    product_photo: 'Product Photo',
    branding: 'Branding',
    memes: 'Memes',
    educational: 'Educational',
    event: 'Event',
    testimonial: 'Testimonial',
    stories: 'Stories',
    email: 'Email',
    thumbnails: 'Thumbnails',
};

// Actual image/video generation models from MMM
// supportsImageRef: true = model can accept a reference image directly
const MODELS = {
    gemini: {
        image: [
            { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0', supportsImageRef: false },
            { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', supportsImageRef: true },
        ],
        video: [
            { value: 'veo-3.1-generate-preview', label: 'Veo 3.1', supportsImageRef: false },
            { value: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast', supportsImageRef: false },
        ],
    },
    openai: {
        image: [
            { value: 'gpt-image-1', label: 'GPT Image 1', supportsImageRef: true },
            { value: 'dall-e-3', label: 'DALL-E 3', supportsImageRef: false },
        ],
        video: [
            { value: 'sora-2', label: 'Sora 2', supportsImageRef: false },
            { value: 'sora-2-pro', label: 'Sora 2 Pro', supportsImageRef: false },
        ],
    },
};

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadPromptConfigs();
    renderCategoryCheckboxes();
    setupEventListeners();
    setupImageUpload();
    updateModelOptions();
});

async function loadPromptConfigs() {
    try {
        const resp = await fetch('/api/prompts');
        promptConfigs = await resp.json();
        console.log('[init] Loaded prompt configs:', Object.keys(promptConfigs));
    } catch (err) {
        console.error('[init] Failed to load prompt configs:', err);
    }
}

// ── Category Checkboxes ─────────────────────────────────────────────
function renderCategoryCheckboxes() {
    const container = document.getElementById('categoryCheckboxes');
    container.innerHTML = '';

    for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
        const chip = document.createElement('label');
        chip.className = 'checkbox-chip';
        chip.innerHTML = `
      <input type="checkbox" value="${key}" />
      <span class="chip-dot"></span>
      ${label}
    `;

        const input = chip.querySelector('input');
        input.addEventListener('change', () => {
            chip.classList.toggle('active', input.checked);
        });

        container.appendChild(chip);
    }
}

function getSelectedCategories() {
    const checkboxes = document.querySelectorAll('#categoryCheckboxes input:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// ── Event Listeners ─────────────────────────────────────────────────
function setupEventListeners() {
    // Provider toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedProvider = btn.dataset.provider;
            updateModelOptions();
        });
    });

    // Content type change → update model list
    document.getElementById('contentTypeSelect').addEventListener('change', updateModelOptions);

    // Assemble
    document.getElementById('assembleBtn').addEventListener('click', handleAssemble);

    // Generate
    document.getElementById('generateBtn').addEventListener('click', handleGenerate);
}

// ── Image Upload ────────────────────────────────────────────────────
function setupImageUpload() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('imageInput');
    const placeholder = document.getElementById('uploadPlaceholder');
    const preview = document.getElementById('uploadPreview');
    const previewImg = document.getElementById('previewImg');
    const removeBtn = document.getElementById('removeImage');

    // Click to browse
    zone.addEventListener('click', (e) => {
        if (e.target === removeBtn || e.target.closest('.upload-remove')) return;
        input.click();
    });

    // File selected
    input.addEventListener('change', () => {
        if (input.files?.[0]) handleImageFile(input.files[0]);
    });

    // Drag & drop
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) handleImageFile(file);
    });

    // Remove
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedImageBase64 = null;
        input.value = '';
        placeholder.style.display = '';
        preview.style.display = 'none';
        updateModelOptions(); // re-evaluate model selection
    });

    function handleImageFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            uploadedImageBase64 = reader.result; // data:image/...;base64,...
            previewImg.src = uploadedImageBase64;
            placeholder.style.display = 'none';
            preview.style.display = '';
            updateModelOptions(); // auto-select image-capable model
        };
        reader.readAsDataURL(file);
    }
}

function updateModelOptions() {
    const select = document.getElementById('modelSelect');
    const contentType = document.getElementById('contentTypeSelect').value;
    const mediaType = (contentType === 'video') ? 'video' : 'image';
    const hasImage = !!uploadedImageBase64;

    let models = MODELS[selectedProvider]?.[mediaType] || [];

    if (hasImage) {
        // Check if current provider has any image-capable model for this media type
        const capable = models.filter(m => m.supportsImageRef);

        if (capable.length > 0) {
            // Show all models but auto-select the image-capable one
            select.innerHTML = models.map(m => {
                const recommended = m.supportsImageRef ? ' ⭐ (uses your image)' : '';
                return `<option value="${m.value}"${m.supportsImageRef ? ' selected' : ''}>${m.label}${recommended}</option>`;
            }).join('');
            return;
        }

        // Current provider has no image-capable model — try switching provider
        const otherProvider = selectedProvider === 'gemini' ? 'openai' : 'gemini';
        const otherModels = MODELS[otherProvider]?.[mediaType] || [];
        const otherCapable = otherModels.filter(m => m.supportsImageRef);

        if (otherCapable.length > 0) {
            // Auto-switch provider
            selectedProvider = otherProvider;
            document.querySelectorAll('.toggle-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.provider === otherProvider);
            });
            models = otherModels;
            select.innerHTML = models.map(m => {
                const recommended = m.supportsImageRef ? ' ⭐ (uses your image)' : '';
                return `<option value="${m.value}"${m.supportsImageRef ? ' selected' : ''}>${m.label}${recommended}</option>`;
            }).join('');
            showToast(`Switched to ${otherProvider === 'gemini' ? 'Gemini' : 'OpenAI'} — supports image references`);
            return;
        }
    }

    // Default: show all models normally
    select.innerHTML = models.map(m =>
        `<option value="${m.value}">${m.label}</option>`
    ).join('');
}

// ── Assemble ────────────────────────────────────────────────────────
async function handleAssemble() {
    const categories = getSelectedCategories();
    const platform = document.getElementById('platformSelect').value;
    const contentType = document.getElementById('contentTypeSelect').value;
    const title = document.getElementById('titleInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();

    if (!categories.length) {
        showToast('Select at least one category');
        return;
    }
    if (!title) {
        showToast('Enter a product title');
        return;
    }

    const btn = document.getElementById('assembleBtn');
    setBtnLoading(btn, true);

    try {
        const payload = { categories, platform, contentType, title, description };
        if (uploadedImageBase64) payload.image = uploadedImageBase64;

        const resp = await fetch('/api/assemble', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        assembledResults = data.results || [];
        selectedPromptIndex = assembledResults.length > 0 ? 0 : -1;
        renderPromptResults();
        updateNicheDisplay();

        document.getElementById('generateBtn').disabled = assembledResults.length === 0;
        document.getElementById('promptCount').textContent = `${assembledResults.length} prompt${assembledResults.length !== 1 ? 's' : ''}`;
    } catch (err) {
        console.error('[assemble]', err);
        showToast('Assembly failed: ' + err.message);
    } finally {
        setBtnLoading(btn, false);
    }
}

function renderPromptResults() {
    const container = document.getElementById('promptResults');

    if (!assembledResults.length) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>Select categories and click <strong>Assemble Prompts</strong> to preview</p>
      </div>`;
        return;
    }

    container.innerHTML = assembledResults.map((r, i) => `
    <div class="prompt-card ${i === selectedPromptIndex ? 'selected' : ''}" data-index="${i}">
      <div class="prompt-card-header" onclick="window.__selectPrompt(${i})">
        <span class="prompt-card-title">
          ${CATEGORY_LABELS[r.category] || r.category}
        </span>
        <div class="prompt-card-meta">
          <span class="niche-badge detected">${r.niche}</span>
          <span class="niche-badge">${r.platform}</span>
        </div>
      </div>
      <div class="prompt-card-body">
        <pre class="prompt-text">${escapeHtml(r.prompt)}</pre>
      </div>
      <div class="prompt-card-actions">
        <button class="btn-small" onclick="window.__copyPrompt(${i})">📋 Copy</button>
        <button class="btn-small" onclick="window.__sendSingle(${i})">🚀 Generate</button>
      </div>
    </div>
  `).join('');
}

function updateNicheDisplay() {
    const container = document.getElementById('nicheDisplay');
    const niches = [...new Set(assembledResults.map(r => r.niche))];

    if (!niches.length) {
        container.innerHTML = '<span class="niche-badge">—</span>';
        return;
    }

    container.innerHTML = niches.map(n =>
        `<span class="niche-badge detected">${n}</span>`
    ).join('');
}

// ── Generate (Image/Video) ──────────────────────────────────────────
async function handleGenerate() {
    if (!assembledResults.length) return;
    const idx = selectedPromptIndex >= 0 ? selectedPromptIndex : 0;
    const prompt = assembledResults[idx]?.prompt;
    if (!prompt) return;
    await sendToAI(prompt);
}

async function sendToAI(prompt) {
    const model = document.getElementById('modelSelect').value;
    const contentType = document.getElementById('contentTypeSelect').value;
    const btn = document.getElementById('generateBtn');
    const responseArea = document.getElementById('responseArea');

    setBtnLoading(btn, true);
    responseArea.innerHTML = `
    <div class="empty-state small">
      <div class="spinner"></div>
      <p>Generating ${contentType === 'video' ? 'video' : 'image'}... this may take a moment</p>
    </div>`;

    try {
        const payload = {
            prompt,
            provider: selectedProvider,
            model,
            contentType: contentType === 'video' ? 'video' : 'image',
        };
        if (uploadedImageBase64) payload.referenceImage = uploadedImageBase64;

        const resp = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        renderMediaResult(data);
    } catch (err) {
        console.error('[generate]', err);
        responseArea.innerHTML = `<div class="error-msg">❌ ${escapeHtml(err.message)}</div>`;
    } finally {
        setBtnLoading(btn, false);
    }
}

function renderMediaResult(data) {
    const responseArea = document.getElementById('responseArea');

    if (data.type === 'image' && data.data) {
        const src = `data:${data.mimeType || 'image/png'};base64,${data.data}`;
        responseArea.innerHTML = `
      <div class="media-result">
        <img src="${src}" alt="Generated image" class="generated-image" />
        <div class="media-actions">
          <button class="btn-small" onclick="window.__downloadMedia('${src}', 'generated-image.png')">💾 Download</button>
          <span class="media-info">${data.provider} · ${data.model}</span>
        </div>
      </div>`;
        return;
    }

    if (data.type === 'video' && data.data) {
        const src = `data:${data.mimeType || 'video/mp4'};base64,${data.data}`;
        responseArea.innerHTML = `
      <div class="media-result">
        <video controls autoplay class="generated-video">
          <source src="${src}" type="${data.mimeType || 'video/mp4'}" />
        </video>
        <div class="media-actions">
          <button class="btn-small" onclick="window.__downloadMedia('${src}', 'generated-video.mp4')">💾 Download</button>
          <span class="media-info">${data.provider} · ${data.model}</span>
        </div>
      </div>`;
        return;
    }

    responseArea.innerHTML = `<div class="error-msg">Unexpected response format</div>`;
}

// ── Global Helpers ──────────────────────────────────────────────────
window.__selectPrompt = (index) => {
    selectedPromptIndex = index;
    document.querySelectorAll('.prompt-card').forEach((card, i) => {
        card.classList.toggle('selected', i === index);
    });
};

window.__copyPrompt = (index) => {
    const text = assembledResults[index]?.prompt || '';
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
};

window.__sendSingle = async (index) => {
    selectedPromptIndex = index;
    document.querySelectorAll('.prompt-card').forEach((card, i) => {
        card.classList.toggle('selected', i === index);
    });
    const prompt = assembledResults[index]?.prompt;
    if (prompt) await sendToAI(prompt);
};

window.__downloadMedia = (dataUrl, filename) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
};

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function setBtnLoading(btn, loading) {
    if (loading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.textContent = msg;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        padding: '0.6rem 1.2rem',
        borderRadius: '8px',
        fontSize: '0.82rem',
        fontWeight: '500',
        boxShadow: 'var(--shadow-lg)',
        zIndex: '9999',
        animation: 'fadeIn 0.2s ease-out',
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}
