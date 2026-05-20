import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
/* Import useTheme early — its module-level code applies data-theme before first paint */
import './hooks/useTheme.js'
import App from './App.jsx'
import ErrorBoundary from './ui/components/ErrorBoundary/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
