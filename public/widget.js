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
  let isOpen = false
  let messages = []

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

  function addBotMessage(text) {
    messages.push({ role: 'bot', text })
    const el = document.createElement('div')
    el.className = 'actero-msg bot'
    el.textContent = text
    msgsEl.appendChild(el)
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

  async function send() {
    const text = inputEl.value.trim()
    if (!text || sending) return
    inputEl.value = ''
    addUserMessage(text)

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
        body: JSON.stringify({ message: text, session_id: sessionId }),
      })
      const data = await res.json()
      loader.remove()
      addBotMessage(data.response || 'Merci, un agent va vous repondre.')
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
