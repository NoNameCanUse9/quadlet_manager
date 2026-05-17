import { useTranslation } from 'react-i18next'
import { AlertTriangle, X } from 'lucide-react'

interface ErrorBannerProps {
  message: string | null
  onDismiss?: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const { t } = useTranslation()
  if (!message) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border border-red-500/20 rounded text-xs text-danger">
      <AlertTriangle size={12} />
      <span className="flex-1">
        {t('common.error')}: {message}
      </span>
      {onDismiss && (
        <button onClick={onDismiss} className="p-0.5 hover:text-text-primary transition-colors">
          <X size={12} />
        </button>
      )}
    </div>
  )
}
