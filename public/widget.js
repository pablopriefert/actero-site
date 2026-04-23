/**
 * Actero Chat Widget — Embeddable customer chat
 *
 * Usage: Add this to your website:
 * <script src="https://actero.fr/widget.js" data-actero-key="YOUR_CLIENT_ID"></script>
 */
(function() {
  const ACTERO_URL = 'https://actero.fr'
  const script = document.currentScript
  const apiKey = script?.getAttribute('data-actero-key')
  if (!apiKey) return console.warn('[Actero] Missing data-actero-key attribute')

  const sessionId = 'actero_' + Math.random().toString(36).substring(2, 10)
  const STORAGE_KEY = 'actero_customer_' + apiKey
  let isOpen = false
  let messages = []
  let customerEmail = null
  let customerName = null
  let messageCount = 0 // track exchanges to ask for email after 2nd reply
  let emailAsked = false

  // Try to restore from localStorage so returning visitors are recognized
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (saved.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saved.email)) {
      customerEmail = saved.email
      customerName = saved.name || null
      emailAsked = true
    }
  } catch {}

  // Styles
  const style = document.createElement('style')
  style.textContent = `
    #actero-widget-btn {
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 50%;
      background: #0F5F35; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(15,95,53,0.3);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #actero-widget-btn:hover { transform: scale(1.05); box-shadow: 0 6px 24px rgba(15,95,53,0.4); }
    #actero-widget-btn svg { width: 24px; height: 24px; fill: white; }
    #actero-widget-panel {
      position: fixed; bottom: 88px; right: 20px; z-index: 99999;
      width: 380px; max-width: calc(100vw - 40px); height: 500px; max-height: calc(100vh - 120px);
      background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      display: none; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #actero-widget-panel.open { display: flex; }
    .actero-header {
      padding: 16px; background: #0F5F35; color: white;
      display: flex; align-items: center; gap: 10px;
    }
    .actero-header-dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; }
    .actero-header h3 { margin: 0; font-size: 14px; font-weight: 600; }
    .actero-header p { margin: 0; font-size: 11px; opacity: 0.7; }
    .actero-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex;
      flex-direction: column; gap: 10px;
    }
    .actero-msg {
      max-width: 80%; padding: 10px 14px; border-radius: 14px;
      font-size: 13px; line-height: 1.5; word-break: break-word;
    }
    .actero-msg.user {
      align-self: flex-end; background: #0F5F35; color: white;
      border-bottom-right-radius: 4px;
    }
    .actero-msg.bot {
      align-self: flex-start; background: #f5f5f0; color: #262626;
      border-bottom-left-radius: 4px;
    }
    .actero-msg.loading { opacity: 0.6; }
    .actero-input-area {
      padding: 12px; border-top: 1px solid #e5e5e5;
      display: flex; gap: 8px;
    }
    .actero-input-area input {
      flex: 1; border: 1px solid #e5e5e5; border-radius: 10px;
      padding: 10px 14px; font-size: 13px; outline: none;
      background: #fafafa;
    }
    .actero-input-area input:focus { border-color: #0F5F35; background: white; }
    .actero-input-area button {
      width: 38px; height: 38px; border-radius: 10px;
      background: #0F5F35; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    .actero-input-area button:hover { background: #003725; }
    .actero-input-area button:disabled { opacity: 0.4; cursor: not-allowed; }
    .actero-input-area button svg { width: 16px; height: 16px; fill: white; }
    .actero-powered {
      text-align: center; padding: 6px; font-size: 10px; color: #999;
    }
    .actero-powered a { color: #0F5F35; text-decoration: none; font-weight: 600; }
    .actero-products {
      display: flex; flex-direction: column; gap: 6px;
      align-self: flex-start; max-width: 80%;
    }
    .actero-product-card {
      display: flex; align-items: center; gap: 10px; padding: 8px;
      background: white; border: 1px solid #e5e5e5; border-radius: 10px;
      text-decoration: none; color: inherit; transition: border-color 0.2s, box-shadow 0.2s;
    }
    .actero-product-card:hover { border-color: #0F5F35; box-shadow: 0 2px 8px rgba(15,95,53,0.08); }
    .actero-product-card img {
      width: 48px; height: 48px; border-radius: 6px; object-fit: cover; flex-shrink: 0;
    }
    .actero-product-card > div { flex: 1; min-width: 0; }
    .actero-product-title {
      margin: 0; font-size: 12px; font-weight: 600; color: #262626;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .actero-product-price {
      margin: 2px 0 0; font-size: 12px; color: #0F5F35; font-weight: 700;
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
      position: absolute; top: 2px; right: 2px; width: 18px; height: 18px;
      border-radius: 50%; background: rgba(0,0,0,0.65); color: white;
      border: none; cursor: pointer; font-size: 12px; line-height: 1;
      display: flex; align-items: center; justify-content: center; padding: 0;
    }
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
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>'
  btn.onclick = function() {
    isOpen = !isOpen
    panel.classList.toggle('open', isOpen)
    if (isOpen && messages.length === 0) {
      addBotMessage('Bonjour ! Comment puis-je vous aider ?')
    }
  }
  document.body.appendChild(btn)

  // Panel
  const panel = document.createElement('div')
  panel.id = 'actero-widget-panel'
  panel.innerHTML = `
    <div class="actero-header">
      <div class="actero-header-dot"></div>
      <div>
        <h3>Support</h3>
        <p>En ligne — reponse instantanee</p>
      </div>
    </div>
    <div class="actero-messages" id="actero-msgs"></div>
    <div class="actero-pending-images" id="actero-pending"></div>
    <div class="actero-attach-error" id="actero-attach-err" style="display:none"></div>
    <div class="actero-input-area">
      <button id="actero-attach" class="actero-attach-btn" type="button" title="Joindre une photo (max 5 × 5 Mo)">
        <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z"/></svg>
      </button>
      <input type="file" id="actero-file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple style="display:none" />
      <input type="text" id="actero-input" placeholder="Votre message..." />
      <button id="actero-send">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
    <div class="actero-powered">Propulse par <a href="https://actero.fr" target="_blank">Actero</a></div>
  `
  document.body.appendChild(panel)

  const msgsEl = document.getElementById('actero-msgs')
  const inputEl = document.getElementById('actero-input')
  const sendBtn = document.getElementById('actero-send')
  const attachBtn = document.getElementById('actero-attach')
  const fileInput = document.getElementById('actero-file')
  const pendingEl = document.getElementById('actero-pending')
  const attachErrEl = document.getElementById('actero-attach-err')
  let sending = false

  const MAX_IMAGES = 5
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024
  const pendingImages = [] // array of { dataUrl, thumbEl }

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
    thumb.appendChild(img)
    const remove = document.createElement('button')
    remove.className = 'actero-thumb-remove'
    remove.type = 'button'
    remove.textContent = '×'
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
        showAttachError('"' + file.name + '" depasse 5 Mo.')
        return
      }
      const reader = new FileReader()
      reader.onload = function() {
        const dataUrl = reader.result
        if (typeof dataUrl !== 'string') return
        const thumbEl = renderThumb(dataUrl)
        pendingImages.push({ dataUrl: dataUrl, thumbEl: thumbEl })
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

  function addBotMessage(text) {
    messages.push({ role: 'assistant', text })
    const el = document.createElement('div')
    el.className = 'actero-msg bot'
    el.textContent = text
    msgsEl.appendChild(el)
    msgsEl.scrollTop = msgsEl.scrollHeight
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
    msgsEl.scrollTop = msgsEl.scrollHeight
  }

  function addUserMessage(text, imageDataUrls) {
    messages.push({ role: 'user', text })
    const el = document.createElement('div')
    el.className = 'actero-msg user'
    if (text) el.textContent = text
    if (imageDataUrls && imageDataUrls.length) {
      imageDataUrls.forEach(function(src) {
        const img = document.createElement('img')
        img.className = 'actero-msg-img'
        img.src = src
        el.appendChild(img)
      })
    }
    msgsEl.appendChild(el)
    msgsEl.scrollTop = msgsEl.scrollHeight
  }

  // Build conversation history for the API (last 10 exchanges max)
  function getConversationHistory() {
    // Skip the initial greeting, send real exchanges only
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20) // last 20 messages (10 exchanges)
      .map(m => ({ role: m.role, content: m.text }))
    return history
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

    // Loading indicator
    const loader = document.createElement('div')
    loader.className = 'actero-msg bot loading'
    loader.textContent = '...'
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
      const data = await res.json()
      loader.remove()
      addBotMessage(data.response || 'Merci, un agent va vous repondre.')
      if (data.product_recommendations && data.product_recommendations.length > 0) {
        addProductCards(data.product_recommendations)
      }
      messageCount++

      // After 2nd AI response, politely ask for email (non-blocking)
      if (messageCount === 2 && !customerEmail && !emailAsked) {
        emailAsked = true
        setTimeout(function() {
          addBotMessage('Au fait, si vous souhaitez qu\'on puisse vous recontacter, n\'hesitez pas a me laisser votre email dans la conversation.')
        }, 1500)
      }
    } catch {
      loader.remove()
      addBotMessage('Erreur de connexion. Reessayez dans un instant.')
    }

    sending = false
    sendBtn.disabled = false
    attachBtn.disabled = false
    inputEl.focus()
  }

  sendBtn.onclick = send
  inputEl.onkeydown = function(e) { if (e.key === 'Enter') send() }
})()
