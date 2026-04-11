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
  let step = 'email' // 'email' | 'chat'

  // Try to restore from localStorage so returning visitors skip the email step
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    if (saved.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saved.email)) {
      customerEmail = saved.email
      customerName = saved.name || null
      step = 'chat'
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
      if (step === 'email') {
        addBotMessage('Bonjour ! 👋 Pour mieux vous aider et pouvoir vous recontacter, pouvez-vous me laisser votre email ?')
        inputEl.placeholder = 'votre@email.com'
        inputEl.type = 'email'
      } else {
        addBotMessage('Bonjour ! Comment puis-je vous aider ?')
      }
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
    <div class="actero-input-area">
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
  let sending = false

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

  function addUserMessage(text) {
    messages.push({ role: 'user', text })
    const el = document.createElement('div')
    el.className = 'actero-msg user'
    el.textContent = text
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
    if (!text || sending) return
    inputEl.value = ''
    addUserMessage(text)

    // Step 1 — collect email before starting the real chat
    if (step === 'email') {
      const email = extractEmail(text) || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null)
      if (!email) {
        addBotMessage("Cet email ne semble pas valide. Pouvez-vous le verifier et reessayer ? Exemple : prenom@domaine.com")
        inputEl.focus()
        return
      }
      customerEmail = email
      const foundName = extractName(text)
      if (foundName) customerName = foundName

      // Persist for returning visitors
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: customerEmail, name: customerName }))
      } catch {}

      step = 'chat'
      inputEl.placeholder = 'Votre message...'
      inputEl.type = 'text'
      addBotMessage('Merci ! Comment puis-je vous aider aujourd\'hui ?')
      inputEl.focus()
      return
    }

    // Step 2 — normal chat: also extract any email/name if present in the text
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
        }),
      })
      const data = await res.json()
      loader.remove()
      addBotMessage(data.response || 'Merci, un agent va vous repondre.')
      if (data.product_recommendations && data.product_recommendations.length > 0) {
        addProductCards(data.product_recommendations)
      }
    } catch {
      loader.remove()
      addBotMessage('Erreur de connexion. Reessayez dans un instant.')
    }

    sending = false
    sendBtn.disabled = false
    inputEl.focus()
  }

  sendBtn.onclick = send
  inputEl.onkeydown = function(e) { if (e.key === 'Enter') send() }
})()
