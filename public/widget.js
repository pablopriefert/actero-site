/**
 * Actero Chat Widget — Embeddable customer chat
 *
 * Usage: Add this to your website:
 * <script src="https://actero.fr/widget.js" data-actero-key="YOUR_CLIENT_ID"></script>
 */
(function() {
  const ACTERO_URL = 'https://actero.fr'
  // `document.currentScript` is only valid synchronously at load — capture now.
  const script = document.currentScript
  const apiKey = script?.getAttribute('data-actero-key')
  if (!apiKey) return console.warn('[Actero] Missing data-actero-key attribute')

  // Runtime config — merchant-customizable from the Actero dashboard, served by
  // /api/engine/widget-config. We start with the factory defaults (same values
  // the widget has always shipped) so the UI renders instantly, then fetch the
  // merchant's config and apply it. If the fetch fails, the defaults stand —
  // the widget can never be broken by a config problem.
  const CFG = {
    brandColor: '#0F5F35',
    accentColor: '#14A85C',
    position: 'bottom-right',
    greeting: 'Bonjour ! Comment puis-je vous aider ?',
    logoUrl: null,
    showPoweredBy: true,
    agentEnabled: true,
  }
  // Data-attribute overrides let the Shopify theme app extension pass a couple
  // of hints synchronously before the server config resolves (nice for FOUC).
  const attrAccent = script?.getAttribute('data-actero-accent')
  const attrPos = script?.getAttribute('data-actero-position')
  if (attrAccent) CFG.brandColor = attrAccent
  if (attrPos === 'bottom-left' || attrPos === 'bottom-right') CFG.position = attrPos

  // Expose the theme colors as CSS variables so the stylesheet can reference
  // them; updating the variable later (once server config loads) restyles live.
  // Darken a hex color by `amt` (0–1) — used to derive the gradient's darker
  // stop + the hover shade from the merchant's single brand color.
  function darken(hex, amt) {
    try {
      let h = String(hex).replace('#', '')
      if (h.length === 3) h = h.split('').map(function(c) { return c + c }).join('')
      const n = parseInt(h, 16)
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
      r = Math.max(0, Math.round(r * (1 - amt)))
      g = Math.max(0, Math.round(g * (1 - amt)))
      b = Math.max(0, Math.round(b * (1 - amt)))
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
    } catch { return hex }
  }
  function applyThemeVars() {
    const root = document.documentElement
    root.style.setProperty('--actero-primary', CFG.brandColor)
    root.style.setProperty('--actero-accent', CFG.accentColor)
    // Darker stop for the header/launcher gradient + button hover.
    root.style.setProperty('--actero-primary-dark', darken(CFG.brandColor, 0.35))
  }
  applyThemeVars()

  // Stable session id across reloads (sessionStorage), so the thread restores
  const SESSION_KEY = 'actero_session_' + apiKey
  let sessionId
  try {
    sessionId = sessionStorage.getItem(SESSION_KEY)
  } catch {}
  if (!sessionId) {
    sessionId = 'actero_' + Math.random().toString(36).substring(2, 10)
    try { sessionStorage.setItem(SESSION_KEY, sessionId) } catch {}
  }
  const STORAGE_KEY = 'actero_customer_' + apiKey
  const THREAD_KEY = 'actero_thread_' + apiKey
  let isOpen = false
  let messages = []
  let customerEmail = null
  let customerName = null
  let messageCount = 0 // track exchanges to ask for email after 2nd reply
  let emailAsked = false
  let previouslyFocusedEl = null

  // Try to restore from localStorage so returning visitors are recognized
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (saved.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saved.email)) {
      customerEmail = saved.email
      customerName = saved.name || null
      emailAsked = true
    }
  } catch {}

  // Brand fonts (Instrument Serif for the greeting, DM Sans for the UI).
  // display=swap → never blocks; falls back to system fonts if a merchant CSP
  // blocks Google Fonts. Scoped to the widget via font-family.
  try {
    if (!document.getElementById('actero-fonts')) {
      const f = document.createElement('link')
      f.id = 'actero-fonts'
      f.rel = 'stylesheet'
      f.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap'
      document.head.appendChild(f)
    }
  } catch {}

  // Styles
  const style = document.createElement('style')
  style.textContent = `
    #actero-widget-btn {
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      width: 62px; height: 62px; border-radius: 50%;
      background: linear-gradient(150deg, var(--actero-primary, #1F3A12), var(--actero-primary-dark, #0B4B2C));
      border: none; cursor: pointer;
      box-shadow: 0 6px 22px rgba(11,75,44,0.38);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #actero-widget-btn:hover { transform: scale(1.05); box-shadow: 0 8px 28px rgba(11,75,44,0.46); }
    #actero-widget-btn:focus-visible { outline: 3px solid #4ade80; outline-offset: 2px; }
    #actero-widget-btn svg { width: 26px; height: 26px; fill: white; }
    #actero-widget-panel {
      position: fixed; bottom: 92px; right: 20px; z-index: 99999;
      width: 400px; max-width: calc(100vw - 40px); height: 640px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 24px;
      box-shadow: 0 2px 8px rgba(11,75,44,0.08), 0 24px 60px rgba(11,75,44,0.22);
      display: none; flex-direction: column; overflow: hidden;
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    @media (max-width: 480px) {
      #actero-widget-panel {
        bottom: 0; right: 0; left: 0; width: 100%; max-width: 100%;
        height: 100dvh; max-height: 100dvh; border-radius: 0;
      }
    }
    #actero-widget-panel.open { display: flex; }
    .actero-header {
      background: linear-gradient(150deg, var(--actero-primary, #1F3A12), var(--actero-primary-dark, #0B4B2C));
      color: white; padding: 22px 22px 26px; position: relative;
    }
    .actero-brandrow { display: flex; align-items: center; gap: 11px; }
    .actero-av {
      width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0; overflow: hidden;
      background: rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center;
    }
    .actero-av img { width: 100%; height: 100%; object-fit: cover; }
    .actero-av svg { width: 20px; height: 20px; fill: #fff; }
    .actero-header-text { min-width: 0; }
    .actero-brand-name { font-size: 15px; font-weight: 600; letter-spacing: -0.2px; }
    .actero-brand-status { font-size: 12px; color: var(--actero-soft, #A8C490); display: flex; align-items: center; gap: 5px; margin-top: 1px; }
    .actero-header-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 0 3px rgba(74,222,128,0.25); flex-shrink: 0; }
    .actero-greet { margin-top: 20px; }
    .actero-greet h3 { margin: 0; font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-size: 30px; line-height: 1.12; letter-spacing: -0.01em; }
    .actero-greet p { margin: 4px 0 0; font-size: 13.5px; color: rgba(255,255,255,0.78); }
    .actero-close-btn {
      position: absolute; top: 20px; right: 20px;
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(255,255,255,0.12); border: none; cursor: pointer;
      color: white; display: flex; align-items: center; justify-content: center;
      padding: 0; transition: background 0.15s; touch-action: manipulation;
    }
    .actero-close-btn:hover { background: rgba(255,255,255,0.22); }
    .actero-close-btn:focus-visible { outline: 2px solid #4ade80; outline-offset: 1px; }
    .actero-close-btn svg { width: 15px; height: 15px; fill: white; }
    .actero-messages {
      flex: 1; overflow-y: auto; padding: 20px 18px; display: flex;
      flex-direction: column; gap: 14px; background: #FBFAF7;
    }
    .actero-msg-row { display: flex; gap: 9px; align-items: flex-end; max-width: 88%; }
    .actero-msg-row.user { align-self: flex-end; flex-direction: row-reverse; max-width: 82%; }
    .actero-msg-row.bot { align-self: flex-start; }
    .actero-msg-av {
      width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0; overflow: hidden;
      background: var(--actero-tint, #E8F5EC); display: flex; align-items: center; justify-content: center;
    }
    .actero-msg-av img { width: 100%; height: 100%; object-fit: cover; }
    .actero-msg-av svg { width: 14px; height: 14px; }
    .actero-msg-stack { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .actero-msg-row.user .actero-msg-stack { align-items: flex-end; }
    .actero-msg {
      padding: 11px 14px; border-radius: 16px; max-width: 100%;
      font-size: 13.5px; line-height: 1.5; word-break: break-word;
    }
    .actero-msg.user {
      background: var(--actero-primary, #0F5F35); color: white; border-bottom-right-radius: 5px;
    }
    .actero-msg.bot {
      background: #fff; color: #1A1A1A; border: 1px solid rgba(0,0,0,0.05);
      border-bottom-left-radius: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .actero-msg.loading {
      display: inline-flex; align-items: center; gap: 4px; min-height: 20px;
    }
    .actero-chips {
      display: flex; flex-wrap: wrap; gap: 8px; align-self: flex-start;
      padding-left: 35px; max-width: 92%;
    }
    .actero-chip {
      font-size: 12.5px; font-weight: 500; color: var(--actero-primary-dark, #0B4B2C);
      background: #fff; border: 1px solid var(--actero-soft, #A8C490); border-radius: 9999px;
      padding: 8px 14px; cursor: pointer; transition: background 0.15s;
    }
    .actero-chip:hover { background: var(--actero-tint, #E8F5EC); }
    .actero-chip:focus-visible { outline: 2px solid #4ade80; outline-offset: 1px; }
    .actero-typing-dot {
      display: inline-block; width: 6px; height: 6px; border-radius: 50%;
      background: #9aa39a; opacity: 0.35;
      animation: actero-typing 1.2s infinite ease-in-out;
    }
    .actero-typing-dot.typing-dot-1 { animation-delay: 0ms; }
    .actero-typing-dot.typing-dot-2 { animation-delay: 400ms; }
    .actero-typing-dot.typing-dot-3 { animation-delay: 800ms; }
    @keyframes actero-typing {
      0%, 60%, 100% { opacity: 0.35; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-2px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .actero-typing-dot { animation: none; opacity: 0.6; }
      #actero-widget-btn { transition: none; }
      #actero-widget-btn:hover { transform: none; }
    }
    .actero-msg-time {
      font-size: 10px; color: #b0b3ac; padding: 0 6px; user-select: none;
    }
    .actero-input-area {
      padding: 14px 16px 6px; border-top: 1px solid rgba(0,0,0,0.05);
      display: flex; gap: 8px; align-items: center; background: #fff;
    }
    .actero-input-area input[type="text"] {
      flex: 1; border: 1px solid transparent; border-radius: 9999px;
      padding: 12px 16px; font-size: 16px; outline: none;
      background: #F4F3EF; color: #1A1A1A;
    }
    .actero-input-area input[type="text"]:focus { border-color: var(--actero-primary, #0F5F35); background: #fff; }
    .actero-input-area button#actero-send {
      width: 42px; height: 42px; border-radius: 50%;
      background: var(--actero-primary, #0F5F35); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(14,101,58,0.28); transition: background 0.2s, transform 0.15s;
    }
    .actero-input-area button#actero-send:hover { background: var(--actero-primary-dark, #003725); }
    .actero-input-area button#actero-send:active { transform: scale(0.94); }
    .actero-input-area button#actero-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .actero-input-area button#actero-send svg { width: 18px; height: 18px; fill: white; }
    .actero-powered {
      text-align: center; padding: 6px 6px 10px; font-size: 10.5px; color: #b0b3ac; letter-spacing: 0.02em;
    }
    .actero-powered a { color: var(--actero-primary, #0F5F35); text-decoration: none; font-weight: 600; }
    .actero-products {
      display: flex; flex-direction: column; gap: 6px;
      align-self: flex-start; max-width: 80%;
    }
    .actero-product-card {
      display: flex; align-items: center; gap: 10px; padding: 8px;
      background: white; border: 1px solid #e5e5e5; border-radius: 10px;
      text-decoration: none; color: inherit; transition: border-color 0.2s, box-shadow 0.2s;
    }
    .actero-product-card:hover { border-color: var(--actero-primary, #0F5F35); box-shadow: 0 2px 8px rgba(15,95,53,0.08); }
    .actero-product-card img {
      width: 48px; height: 48px; border-radius: 6px; object-fit: cover; flex-shrink: 0;
    }
    .actero-product-card > div { flex: 1; min-width: 0; }
    .actero-product-title {
      margin: 0; font-size: 12px; font-weight: 600; color: #262626;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .actero-product-price {
      margin: 2px 0 0; font-size: 12px; color: var(--actero-primary, #0F5F35); font-weight: 700;
    }
    .actero-attach-btn {
      width: 38px; height: 38px; border-radius: 10px;
      background: #f5f5f0; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s; flex-shrink: 0;
    }
    .actero-attach-btn:hover { background: #e8e8e0; }
    .actero-attach-btn svg { width: 18px; height: 18px; fill: #5A5A5A; }
    .actero-attach-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .actero-pending-images {
      display: flex; gap: 6px; flex-wrap: wrap;
      padding: 8px 12px 0; max-height: 68px; overflow-y: auto;
    }
    .actero-pending-images:empty { display: none; }
    .actero-thumb {
      position: relative; width: 56px; height: 56px; border-radius: 8px;
      overflow: hidden; border: 1px solid #e5e5e5; flex-shrink: 0;
    }
    .actero-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .actero-thumb-remove {
      position: absolute; top: 2px; right: 2px; width: 28px; height: 28px;
      border-radius: 50%; background: rgba(0,0,0,0.65); color: white;
      border: none; cursor: pointer; line-height: 1;
      display: flex; align-items: center; justify-content: center; padding: 0;
      touch-action: manipulation;
    }
    .actero-thumb-remove::before {
      content: ''; position: absolute; top: -8px; right: -8px; bottom: -8px; left: -8px;
    }
    .actero-thumb-remove .actero-thumb-remove-glyph {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; font-size: 14px; font-weight: 600;
      pointer-events: none;
    }
    .actero-thumb-remove:focus-visible { outline: 2px solid #4ade80; outline-offset: 2px; }
    .actero-msg img.actero-msg-img {
      display: block; max-width: 100%; border-radius: 8px; margin-top: 6px;
    }
    .actero-attach-error {
      padding: 4px 12px 0; font-size: 11px; color: #c0392b;
    }
  `
  document.head.appendChild(style)

  // Button
  const btn = document.createElement('button')
  btn.id = 'actero-widget-btn'
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Ouvrir le support chat')
  btn.setAttribute('aria-expanded', 'false')
  btn.setAttribute('aria-controls', 'actero-widget-panel')
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>'
  document.body.appendChild(btn)

  // Panel
  const panel = document.createElement('div')
  panel.id = 'actero-widget-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', 'actero-header-title')
  panel.setAttribute('aria-label', 'Support chat')
  panel.innerHTML = `
    <div class="actero-header">
      <div class="actero-brandrow">
        <div class="actero-av" id="actero-av" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 2L2 30H10L16 18L22 30H30L16 2Z"/></svg></div>
        <div class="actero-header-text">
          <div class="actero-brand-name" id="actero-header-title">Assistant</div>
          <div class="actero-brand-status"><span class="actero-header-dot" aria-hidden="true"></span>En ligne · répond en quelques secondes</div>
        </div>
      </div>
      <button id="actero-close" class="actero-close-btn" type="button" aria-label="Fermer le support chat">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
      <div class="actero-greet">
        <h3>Bonjour 👋</h3>
        <p>Une question ? Je peux vous répondre tout de suite.</p>
      </div>
    </div>
    <div class="actero-messages" id="actero-msgs" role="log" aria-live="polite" aria-atomic="false"></div>
    <div class="actero-pending-images" id="actero-pending"></div>
    <div class="actero-attach-error" id="actero-attach-err" role="alert" style="display:none"></div>
    <div class="actero-input-area">
      <button id="actero-attach" class="actero-attach-btn" type="button" aria-label="Joindre une photo (max 5 × 5 Mo)" title="Joindre une photo (max 5 × 5 Mo)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z"/></svg>
      </button>
      <input type="file" id="actero-file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple style="display:none" aria-hidden="true" tabindex="-1" />
      <input type="text" id="actero-input" placeholder="Votre message..." aria-label="Votre message" />
      <button id="actero-send" type="button" aria-label="Envoyer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
    <div class="actero-powered" id="actero-powered">Propulsé par <a href="https://actero.fr" target="_blank" rel="noopener noreferrer">Actero</a></div>
  `
  document.body.appendChild(panel)

  const msgsEl = document.getElementById('actero-msgs')
  const inputEl = document.getElementById('actero-input')
  const sendBtn = document.getElementById('actero-send')
  const attachBtn = document.getElementById('actero-attach')
  const fileInput = document.getElementById('actero-file')
  const pendingEl = document.getElementById('actero-pending')
  const attachErrEl = document.getElementById('actero-attach-err')
  const closeBtn = document.getElementById('actero-close')
  let sending = false

  const MAX_IMAGES = 5
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024
  const pendingImages = [] // array of { dataUrl, thumbEl }

  function getFocusableInPanel() {
    const selectors = 'button:not([disabled]), [href], input:not([disabled]):not([type="file"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return Array.from(panel.querySelectorAll(selectors)).filter(function(el) {
      return el.offsetParent !== null || el === document.activeElement
    })
  }

  // Quick-reply chips shown under the first greeting — one tap sends the message.
  const QUICK_REPLIES = ['📦 Suivre ma commande', '↩️ Retour / échange', '❓ Question produit']
  function renderChips() {
    const wrap = document.createElement('div')
    wrap.className = 'actero-chips'
    wrap.id = 'actero-chips'
    QUICK_REPLIES.forEach(function(label) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'actero-chip'
      b.textContent = label
      b.onclick = function() {
        wrap.remove()
        inputEl.value = label.replace(/^\S+\s+/, '') // drop the leading emoji
        send()
      }
      wrap.appendChild(b)
    })
    msgsEl.appendChild(wrap)
    scrollToLatest()
  }

  function openPanel() {
    isOpen = true
    previouslyFocusedEl = document.activeElement
    panel.classList.add('open')
    btn.setAttribute('aria-expanded', 'true')
    if (messages.length === 0) {
      const restored = restoreThread()
      if (!restored) {
        addBotMessage(CFG.greeting || 'Bonjour ! Comment puis-je vous aider ?')
        renderChips()
      }
    }
    // focus input
    setTimeout(function() { inputEl.focus() }, 50)
  }

  function closePanel() {
    isOpen = false
    panel.classList.remove('open')
    btn.setAttribute('aria-expanded', 'false')
    // Restore focus
    if (previouslyFocusedEl && typeof previouslyFocusedEl.focus === 'function') {
      previouslyFocusedEl.focus()
    } else {
      btn.focus()
    }
  }

  function togglePanel() {
    if (isOpen) closePanel()
    else openPanel()
  }

  btn.onclick = togglePanel
  closeBtn.onclick = closePanel

  // Keyboard handling: Escape to close, Tab looping for minimal focus trap
  document.addEventListener('keydown', function(e) {
    if (!isOpen) return
    if (e.key === 'Escape') {
      e.preventDefault()
      closePanel()
      return
    }
    if (e.key === 'Tab') {
      const focusable = getFocusableInPanel()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      // Only trap if focus is inside (or about to leave) the panel
      if (!panel.contains(active)) return
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
  })

  function showAttachError(msg) {
    attachErrEl.textContent = msg || ''
    attachErrEl.style.display = msg ? 'block' : 'none'
    if (msg) setTimeout(function() { showAttachError('') }, 4000)
  }

  function renderThumb(dataUrl) {
    const thumb = document.createElement('div')
    thumb.className = 'actero-thumb'
    const img = document.createElement('img')
    img.src = dataUrl
    img.alt = ''
    thumb.appendChild(img)
    const remove = document.createElement('button')
    remove.className = 'actero-thumb-remove'
    remove.type = 'button'
    remove.setAttribute('aria-label', 'Retirer la photo')
    remove.innerHTML = '<span class="actero-thumb-remove-glyph" aria-hidden="true">×</span>'
    remove.onclick = function() {
      const idx = pendingImages.findIndex(function(p) { return p.thumbEl === thumb })
      if (idx >= 0) pendingImages.splice(idx, 1)
      thumb.remove()
    }
    thumb.appendChild(remove)
    pendingEl.appendChild(thumb)
    return thumb
  }

  function handleFiles(files) {
    showAttachError('')
    Array.from(files).forEach(function(file) {
      if (pendingImages.length >= MAX_IMAGES) {
        showAttachError('Maximum ' + MAX_IMAGES + ' images.')
        return
      }
      if (!file.type.startsWith('image/')) {
        showAttachError('"' + file.name + '" n\'est pas une image.')
        return
      }
      if (file.size > MAX_IMAGE_BYTES) {
        showAttachError('"' + file.name + '" dépasse 5 Mo.')
        return
      }
      const reader = new FileReader()
      reader.onload = function() {
        const dataUrl = reader.result
        if (typeof dataUrl !== 'string') return
        const thumbEl = renderThumb(dataUrl)
        pendingImages.push({ dataUrl: dataUrl, thumbEl: thumbEl })
      }
      reader.onerror = function() {
        showAttachError('Le chargement de la photo a échoué.')
      }
      reader.readAsDataURL(file)
    })
  }

  attachBtn.onclick = function() { if (!sending) fileInput.click() }
  fileInput.onchange = function(e) {
    handleFiles(e.target.files)
    fileInput.value = ''
  }

  // Try to extract email from message text
  function extractEmail(text) {
    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    return match ? match[0] : null
  }

  // Try to extract name from message text
  function extractName(text) {
    const patterns = [
      /(?:je (?:suis|m'appelle|me nomme))\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)?)/i,
      /(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    ]
    for (const pat of patterns) {
      const match = text.match(pat)
      if (match) return match[1]
    }
    return null
  }

  function scrollToLatest() {
    try {
      msgsEl.scrollTo({ top: msgsEl.scrollHeight, behavior: 'smooth' })
    } catch {
      msgsEl.scrollTop = msgsEl.scrollHeight
    }
  }

  function formatTime(ts) {
    const d = ts ? new Date(ts) : new Date()
    try {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const ACTERO_A_MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2L2 30H10L16 18L22 30H30L16 2Z" fill="#0B4B2C"/></svg>'
  function botAvatarHTML() {
    if (CFG.logoUrl) {
      return '<img src="' + String(CFG.logoUrl).replace(/"/g, '&quot;') + '" alt="" />'
    }
    return ACTERO_A_MARK
  }
  function renderMessageRow(role, ts) {
    const row = document.createElement('div')
    row.className = 'actero-msg-row ' + (role === 'user' ? 'user' : 'bot')
    if (role !== 'user') {
      const av = document.createElement('div')
      av.className = 'actero-msg-av'
      av.setAttribute('aria-hidden', 'true')
      av.innerHTML = botAvatarHTML()
      row.appendChild(av)
    }
    const stack = document.createElement('div')
    stack.className = 'actero-msg-stack'
    const el = document.createElement('div')
    el.className = 'actero-msg ' + (role === 'user' ? 'user' : 'bot')
    stack.appendChild(el)
    const time = document.createElement('div')
    time.className = 'actero-msg-time'
    time.textContent = formatTime(ts)
    stack.appendChild(time)
    row.appendChild(stack)
    msgsEl.appendChild(row)
    return el
  }

  // Minimal client-side thread persistence so a refresh doesn't lose bubbles.
  // Backend rebuilds history server-side; this only restores visible text.
  function saveThread() {
    try {
      const slim = messages
        .filter(function(m) { return m.role === 'user' || m.role === 'assistant' })
        .slice(-40)
        .map(function(m) { return { role: m.role, text: m.text, ts: m.ts || null } })
      sessionStorage.setItem(THREAD_KEY, JSON.stringify({ session: sessionId, messages: slim }))
    } catch {}
  }

  function restoreThread() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(THREAD_KEY) || '{}')
      if (!raw || raw.session !== sessionId || !Array.isArray(raw.messages)) return false
      let restored = false
      raw.messages.forEach(function(m) {
        if (!m || (m.role !== 'user' && m.role !== 'assistant') || !m.text) return
        messages.push({ role: m.role, text: m.text, ts: m.ts })
        const el = renderMessageRow(m.role, m.ts)
        el.textContent = m.text
        restored = true
      })
      if (restored) scrollToLatest()
      return restored
    } catch {
      return false
    }
  }

  function addBotMessage(text) {
    const ts = Date.now()
    messages.push({ role: 'assistant', text, ts })
    const el = renderMessageRow('assistant', ts)
    el.textContent = text
    scrollToLatest()
    saveThread()
  }

  function addProductCards(products) {
    if (!products || products.length === 0) return
    const container = document.createElement('div')
    container.className = 'actero-products'
    products.slice(0, 3).forEach(function(p) {
      const card = document.createElement('a')
      card.href = p.url || '#'
      card.target = '_blank'
      card.rel = 'noopener noreferrer'
      card.className = 'actero-product-card'
      const safeTitle = String(p.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const safeImg = p.image ? String(p.image).replace(/"/g, '&quot;') : ''
      const priceText = p.price ? `${p.price} ${p.currency === 'EUR' ? '€' : (p.currency || '')}` : ''
      card.innerHTML = `
        ${safeImg ? `<img src="${safeImg}" alt="${safeTitle}" />` : ''}
        <div>
          <p class="actero-product-title">${safeTitle}</p>
          ${priceText ? `<p class="actero-product-price">${priceText}</p>` : ''}
        </div>
      `
      container.appendChild(card)
    })
    msgsEl.appendChild(container)
    scrollToLatest()
  }

  function addUserMessage(text, imageDataUrls) {
    const ts = Date.now()
    messages.push({ role: 'user', text, ts })
    const el = renderMessageRow('user', ts)
    if (text) el.textContent = text
    if (imageDataUrls && imageDataUrls.length) {
      imageDataUrls.forEach(function(src) {
        const img = document.createElement('img')
        img.className = 'actero-msg-img'
        img.src = src
        img.alt = 'Photo envoyée'
        el.appendChild(img)
      })
    }
    scrollToLatest()
    saveThread()
  }

  // Build conversation history for the API (last 10 exchanges max)
  function getConversationHistory() {
    // Skip the initial greeting so the AI doesn't think it already spoke
    var start = 0
    if (messages.length > 0 && messages[0].role === 'assistant') start = 1
    var history = []
    for (var i = start; i < messages.length; i++) {
      var m = messages[i]
      if (m.role === 'user' || m.role === 'assistant') {
        history.push({ role: m.role, content: m.text })
      }
    }
    return history.slice(-20)
  }

  async function send() {
    const text = inputEl.value.trim()
    const hasImages = pendingImages.length > 0
    if ((!text && !hasImages) || sending) return
    inputEl.value = ''
    const imageDataUrls = pendingImages.map(function(p) { return p.dataUrl })
    addUserMessage(text, imageDataUrls)
    // Clear pending thumbs
    pendingImages.splice(0).forEach(function(p) { p.thumbEl.remove() })

    // Extract email/name from any message (non-blocking)
    const foundEmail = extractEmail(text)
    if (foundEmail && !customerEmail) {
      customerEmail = foundEmail
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: customerEmail, name: customerName }))
      } catch {}
    }
    const foundName = extractName(text)
    if (foundName && !customerName) {
      customerName = foundName
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: customerEmail, name: customerName }))
      } catch {}
    }

    sending = true
    sendBtn.disabled = true
    attachBtn.disabled = true

    // Loading indicator — 3 animated dots
    const loader = document.createElement('div')
    loader.className = 'actero-msg bot loading'
    loader.setAttribute('aria-label', 'En train de répondre')
    loader.innerHTML = '<span class="actero-typing-dot typing-dot-1"></span><span class="actero-typing-dot typing-dot-2"></span><span class="actero-typing-dot typing-dot-3"></span>'
    msgsEl.appendChild(loader)
    msgsEl.scrollTop = msgsEl.scrollHeight

    try {
      const res = await fetch(ACTERO_URL + '/api/engine/webhooks/widget?api_key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          email: customerEmail,
          name: customerName,
          history: getConversationHistory(),
          images: imageDataUrls,
        }),
      })
      var data
      try { data = await res.json() } catch { data = {} }
      loader.remove()
      if (!res.ok || data.error) {
        addBotMessage(data.response || 'Un instant, je rencontre un souci technique — réessayez dans quelques secondes 🙏')
      } else {
        addBotMessage(data.response || 'Merci pour votre message. Un membre de notre équipe va vous répondre.')
        if (data.product_recommendations && data.product_recommendations.length > 0) {
          addProductCards(data.product_recommendations)
        }
        messageCount++

        // After 2nd AI response, politely ask for email (non-blocking)
        if (messageCount === 2 && !customerEmail && !emailAsked) {
          emailAsked = true
          setTimeout(function() {
            addBotMessage('Au fait, si vous souhaitez qu\'on puisse vous recontacter, n\'hésitez pas à me laisser votre email dans la conversation.')
          }, 1500)
        }
      }
    } catch {
      loader.remove()
      addBotMessage('Un instant, je rencontre un souci technique — réessayez dans quelques secondes 🙏')
    }

    sending = false
    sendBtn.disabled = false
    attachBtn.disabled = false
    inputEl.focus()
  }

  sendBtn.onclick = send
  inputEl.onkeydown = function(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      send()
    }
  }

  // Mobile: keep the input visible above the on-screen keyboard
  inputEl.addEventListener('focus', function() {
    setTimeout(function() {
      try {
        inputEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } catch {}
      scrollToLatest()
    }, 300)
  })
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() {
      if (isOpen && document.activeElement === inputEl) scrollToLatest()
    })
  }

  // ── Server-driven config ──────────────────────────────────────────────────
  // Apply the merchant's dashboard customization once it arrives. The UI is
  // already on screen with defaults, so this only restyles / repositions —
  // never blocks first paint. Fully fail-soft: any error leaves the defaults.
  function applyServerConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') return

    // Agent switched off from the dashboard → remove the widget entirely.
    if (cfg.agentEnabled === false) {
      try { btn.remove(); panel.remove() } catch {}
      return
    }

    if (cfg.brandColor) CFG.brandColor = cfg.brandColor
    if (cfg.accentColor) CFG.accentColor = cfg.accentColor
    if (typeof cfg.greeting === 'string' && cfg.greeting.trim()) CFG.greeting = cfg.greeting
    if (cfg.position === 'bottom-left' || cfg.position === 'bottom-right') CFG.position = cfg.position
    CFG.logoUrl = cfg.logoUrl || null
    CFG.showPoweredBy = cfg.showPoweredBy !== false

    // Restyle live via CSS variables.
    applyThemeVars()

    // Position — flip to the left corner if requested (default stays right).
    if (CFG.position === 'bottom-left') {
      btn.style.left = '20px'; btn.style.right = 'auto'
      panel.style.left = '20px'; panel.style.right = 'auto'
    } else {
      btn.style.right = '20px'; btn.style.left = 'auto'
      panel.style.right = '20px'; panel.style.left = 'auto'
    }

    // "Powered by Actero" — hidden only on plans that allow it (server already
    // forces it true below Pro, so we just honour what it returns).
    const poweredEl = document.getElementById('actero-powered')
    if (poweredEl) poweredEl.style.display = CFG.showPoweredBy ? '' : 'none'

    // Optional merchant logo → header avatar (falls back to the A-mark).
    if (CFG.logoUrl) {
      const avEl = document.getElementById('actero-av')
      if (avEl) {
        avEl.innerHTML = '<img src="' + String(CFG.logoUrl).replace(/"/g, '&quot;') + '" alt="" />'
      }
    }
  }

  fetch(ACTERO_URL + '/api/engine/widget-config?api_key=' + encodeURIComponent(apiKey))
    .then(function(r) { return r.ok ? r.json() : null })
    .then(function(cfg) { if (cfg) applyServerConfig(cfg) })
    .catch(function() { /* defaults stand — widget never breaks on config */ })
})()
