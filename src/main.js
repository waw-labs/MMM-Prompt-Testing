// ── State ────────────────────────────────────────────────────────────
let promptConfigs = {};
let selectedProvider = 'gemini';
let assembledResults = [];
let selectedPromptIndex = -1;
let selectedVariantIndex = 0;
let uploadedImages = []; // array of base64 data URIs of uploaded product images

const CATEGORY_LABELS = {
    ads: 'Ads',
    social_posts: 'Social Posts',
    branding: 'Branding',
    event: 'Event',
    testimonial: 'Testimonial',
    stories: 'Stories',
    thumbnails: 'Thumbnails',
};

// Actual image/video generation models from MMM
// supportsImageRef: true = model can accept a reference image directly
const MODELS = {
    gemini: {
        image: [
            { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0', supportsImageRef: false, supportsMultiRef: false },
            { value: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2 (4K, 14 refs)', supportsImageRef: true, supportsMultiRef: true },
            { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', supportsImageRef: true, supportsMultiRef: false },
        ],
        video: [
            { value: 'veo-3.1-generate-preview', label: 'Veo 3.1', supportsImageRef: false },
            { value: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast', supportsImageRef: false },
        ],
    },
    openai: {
        image: [
            { value: 'gpt-image-1.5', label: 'GPT Image 1.5 (multi-ref, region-aware)', supportsImageRef: true, supportsMultiRef: true },
            { value: 'gpt-image-1', label: 'GPT Image 1 (4K)', supportsImageRef: true, supportsMultiRef: false },
            { value: 'gpt-image-1-mini', label: 'GPT Image 1 Mini', supportsImageRef: true, supportsMultiRef: false },
            { value: 'dall-e-3', label: 'DALL-E 3', supportsImageRef: false, supportsMultiRef: false },
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

// ── Image Upload (Multi-Image) ──────────────────────────────────────
function setupImageUpload() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('imageInput');
    const placeholder = document.getElementById('uploadPlaceholder');
    const grid = document.getElementById('uploadPreviewGrid');
    const actions = document.getElementById('uploadActions');
    const countEl = document.getElementById('uploadCount');
    const addBtn = document.getElementById('addMoreImages');
    const clearBtn = document.getElementById('removeAllImages');

    // Click to browse (only on placeholder)
    zone.addEventListener('click', (e) => {
        if (e.target.closest('.upload-actions') || e.target.closest('.img-remove-btn') || e.target.closest('.upload-preview-grid')) return;
        input.click();
    });

    // Add more button
    addBtn.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });

    // File selected (multiple)
    input.addEventListener('change', () => {
        if (input.files?.length) handleImageFiles(Array.from(input.files));
        input.value = ''; // reset so same files can be re-added
    });

    // Drag & drop (multiple)
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length) handleImageFiles(files);
    });

    // Clear all
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedImages = [];
        refreshPreviewGrid();
        updateModelOptions();
    });

    function handleImageFiles(files) {
        const remaining = 14 - uploadedImages.length;
        const toAdd = files.slice(0, remaining);
        let loaded = 0;
        toAdd.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                uploadedImages.push(reader.result);
                loaded++;
                if (loaded === toAdd.length) {
                    refreshPreviewGrid();
                    updateModelOptions();
                }
            };
            reader.readAsDataURL(file);
        });
        if (remaining <= 0) showToast('Maximum 14 reference images reached');
    }

    function refreshPreviewGrid() {
        if (uploadedImages.length === 0) {
            grid.style.display = 'none';
            actions.style.display = 'none';
            placeholder.style.display = '';
            return;
        }
        placeholder.style.display = 'none';
        grid.style.display = 'grid';
        actions.style.display = 'flex';
        countEl.textContent = `${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}`;
        grid.innerHTML = uploadedImages.map((src, i) => `
            <div class="preview-thumb">
                <img src="${src}" alt="Ref ${i + 1}" />
                <button class="img-remove-btn" data-idx="${i}" title="Remove">✕</button>
            </div>
        `).join('');
        grid.querySelectorAll('.img-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                uploadedImages.splice(parseInt(btn.dataset.idx), 1);
                refreshPreviewGrid();
                updateModelOptions();
            });
        });
    }
    // expose for external use
    window.__refreshImageGrid = refreshPreviewGrid;
}

function updateModelOptions() {
    const select = document.getElementById('modelSelect');
    const contentType = document.getElementById('contentTypeSelect').value;
    const mediaType = (contentType === 'video') ? 'video' : 'image';
    const hasImage = uploadedImages.length > 0;
    const multiImage = uploadedImages.length > 1;

    let models = MODELS[selectedProvider]?.[mediaType] || [];

    if (hasImage) {
        // Multi-image (>1) → show only multi-ref capable models from all providers
        if (multiImage) {
            const allMultiRef = [];
            for (const [prov, provModels] of Object.entries(MODELS)) {
                const capable = (provModels[mediaType] || []).filter(m => m.supportsMultiRef);
                capable.forEach(m => allMultiRef.push({ ...m, provider: prov }));
            }
            if (allMultiRef.length > 0) {
                select.innerHTML = allMultiRef.map(m => {
                    const provLabel = m.provider === 'gemini' ? '🔵' : '🟢';
                    return `<option value="${m.value}" data-provider="${m.provider}">${provLabel} ${m.label} ⭐</option>`;
                }).join('');
                // Auto-select provider of first option
                const first = allMultiRef[0];
                selectedProvider = first.provider;
                document.querySelectorAll('.toggle-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.provider === first.provider);
                });
                // Sync provider when model changes
                select.onchange = () => {
                    const opt = select.selectedOptions[0];
                    if (opt?.dataset?.provider) {
                        selectedProvider = opt.dataset.provider;
                        document.querySelectorAll('.toggle-btn').forEach(b => {
                            b.classList.toggle('active', b.dataset.provider === opt.dataset.provider);
                        });
                    }
                };
                showToast(`${uploadedImages.length} images → showing multi-ref models only`);
                return;
            }
        }

        // Single image → show all image-capable models
        const capable = models.filter(m => m.supportsImageRef);

        if (capable.length > 0) {
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
        if (uploadedImages.length > 0) payload.image = uploadedImages[0];
        if (uploadedImages.length > 1) payload.images = uploadedImages;

        const resp = await fetch('/api/assemble', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        assembledResults = data.results || [];
        selectedPromptIndex = assembledResults.length > 0 ? 0 : -1;
        selectedVariantIndex = 0;
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

    container.innerHTML = assembledResults.map((r, catIdx) => {
        const allPrompts = r.allPrompts || [{ index: 0, label: 'Default', prompt: r.prompt }];
        const variantCards = allPrompts.map((v, vIdx) => {
            const isSelected = catIdx === selectedPromptIndex && vIdx === selectedVariantIndex;
            const truncated = v.prompt.length > 180 ? v.prompt.substring(0, 180) + '…' : v.prompt;
            return `
            <div class="variant-card ${isSelected ? 'selected' : ''}" 
                 data-cat="${catIdx}" data-var="${vIdx}"
                 onclick="window.__selectVariant(${catIdx}, ${vIdx})">
              <div class="variant-header">
                <span class="variant-label">${escapeHtml(v.label)}</span>
                <div class="variant-actions">
                  <button class="btn-tiny" onclick="event.stopPropagation(); window.__copyVariant(${catIdx}, ${vIdx})" title="Copy">📋</button>
                  <button class="btn-tiny" onclick="event.stopPropagation(); window.__generateVariant(${catIdx}, ${vIdx})" title="Generate">🚀</button>
                </div>
              </div>
              <pre class="variant-preview">${escapeHtml(truncated)}</pre>
              ${isSelected ? `<pre class="variant-full">${escapeHtml(v.prompt)}</pre>` : ''}
            </div>`;
        }).join('');

        return `
    <div class="prompt-card" data-catindex="${catIdx}">
      <div class="prompt-card-header">
        <span class="prompt-card-title">
          ${CATEGORY_LABELS[r.category] || r.category}
        </span>
        <div class="prompt-card-meta">
          <span class="niche-badge detected">${r.niche}</span>
          <span class="niche-badge">${r.platform}</span>
          <span class="badge">${allPrompts.length} variants</span>
        </div>
      </div>
      <div class="variants-grid">
        ${variantCards}
      </div>
    </div>`;
    }).join('');
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
    const catIdx = selectedPromptIndex >= 0 ? selectedPromptIndex : 0;
    const result = assembledResults[catIdx];
    const allPrompts = result?.allPrompts || [{ prompt: result?.prompt }];
    const varIdx = selectedVariantIndex >= 0 ? selectedVariantIndex : 0;
    const prompt = allPrompts[varIdx]?.prompt || result?.prompt;
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
        const platform = document.getElementById('platformSelect')?.value || 'instagram';
        const payload = {
            prompt,
            provider: selectedProvider,
            model,
            contentType: contentType === 'video' ? 'video' : 'image',
            platform,
        };
        if (uploadedImages.length === 1) payload.referenceImage = uploadedImages[0];
        if (uploadedImages.length > 1) payload.referenceImages = uploadedImages;

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
        <img src="${src}" alt="Generated image" class="generated-image" onclick="window.__openLightbox(this.src)" style="cursor:pointer" title="Click to view fullscreen" />
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
window.__selectVariant = (catIdx, varIdx) => {
    selectedPromptIndex = catIdx;
    selectedVariantIndex = varIdx;
    renderPromptResults();
};

window.__copyVariant = (catIdx, varIdx) => {
    const result = assembledResults[catIdx];
    const allPrompts = result?.allPrompts || [{ prompt: result?.prompt }];
    const text = allPrompts[varIdx]?.prompt || '';
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
};

window.__generateVariant = async (catIdx, varIdx) => {
    selectedPromptIndex = catIdx;
    selectedVariantIndex = varIdx;
    renderPromptResults();
    const result = assembledResults[catIdx];
    const allPrompts = result?.allPrompts || [{ prompt: result?.prompt }];
    const prompt = allPrompts[varIdx]?.prompt;
    if (prompt) await sendToAI(prompt);
};

// Legacy handlers (backward compat)
window.__selectPrompt = (index) => {
    selectedPromptIndex = index;
    selectedVariantIndex = 0;
    renderPromptResults();
};

window.__copyPrompt = (index) => {
    const text = assembledResults[index]?.prompt || '';
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
};

window.__sendSingle = async (index) => {
    selectedPromptIndex = index;
    selectedVariantIndex = 0;
    renderPromptResults();
    const prompt = assembledResults[index]?.prompt;
    if (prompt) await sendToAI(prompt);
};

window.__downloadMedia = (dataUrl, filename) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
};

/* ── Fullscreen Lightbox ────────────────────── */
(function initLightbox() {
    const overlay = document.createElement('div');
    overlay.id = 'lightbox-overlay';
    overlay.innerHTML = `
      <button id="lightbox-close" aria-label="Close">✕</button>
      <img id="lightbox-img" src="" alt="Preview" />
      <button id="lightbox-download">💾 Download</button>
    `;
    document.body.appendChild(overlay);

    const img = document.getElementById('lightbox-img');
    const closeBtn = document.getElementById('lightbox-close');
    const dlBtn = document.getElementById('lightbox-download');

    function closeLightbox() { overlay.classList.remove('active'); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLightbox(); });
    closeBtn.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
    dlBtn.addEventListener('click', () => { window.__downloadMedia(img.src, 'generated-image.png'); });

    window.__openLightbox = (src) => {
        img.src = src;
        overlay.classList.add('active');
    };
})();

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
