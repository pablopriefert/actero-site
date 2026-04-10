import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as amplitude from '@amplitude/unified'
import './index.css'
import App from './App.jsx'

// Initialize Amplitude Analytics + Session Replay (client-side only, once per lifecycle)
amplitude.initAll('19e42a5d2488202ad9d13fa8b5d6545', {
  analytics: { autocapture: true },
  sessionReplay: { sampleRate: 1 },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
