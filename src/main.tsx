import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/noto-sans-thai/400.css'
import '@fontsource/noto-sans-thai/700.css'
import './index.css'
import App from './App.tsx'
import { loadDevice } from './db/device'

// Load this device's identity first, so every save can be stamped with it.
loadDevice().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
