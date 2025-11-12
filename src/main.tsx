import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { suppressToneWarnings } from './utils/toneInit'

// Suppress Tone.js AudioContext warnings (expected behavior, harmless)
suppressToneWarnings()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

