import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'

window.addEventListener('error', (event) => {
  console.error('[app] uncaught error:', event.error?.stack ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[app] unhandled rejection:', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
