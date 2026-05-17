import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryProvider } from '@/providers/QueryProvider'
import { Toaster } from 'sonner'
import App from './App'
import '@/i18n'
import '@/styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
      <Toaster position="top-right" richColors />
    </QueryProvider>
  </StrictMode>,
)
