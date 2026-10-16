import React from 'react'
import ReactDOM from 'react-dom/client'
import { initI18n } from './i18n'
import './assets/lib/maplibreSetup'
import App from './App'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'

window.addEventListener('error', (event) => {
  console.error('[app] uncaught error:', event.error?.stack ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[app] unhandled rejection:', event.reason)
})

const root = document.getElementById('root')!
const LANDING_KEY = 'tj_map_open'

function initSeoLanding() {
  const landing = document.getElementById('tj-seo-landing')
  const openBtn = document.getElementById('tj-open-map-btn')
  if (!landing) return

  const openMap = () => {
    try {
      localStorage.setItem(LANDING_KEY, '1')
    } catch {
      /* private mode */
    }
    landing.classList.add('tj-seo-landing--hidden')
    root.classList.remove('tj-app-root--beneath')
  }

  let skip = false
  try {
    skip = localStorage.getItem(LANDING_KEY) === '1'
  } catch {
    skip = false
  }

  if (skip) {
    landing.classList.add('tj-seo-landing--hidden')
  } else {
    root.classList.add('tj-app-root--beneath')
    openBtn?.addEventListener('click', openMap)
  }
}

initSeoLanding()

void initI18n().then(() => {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
