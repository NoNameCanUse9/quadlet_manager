import { useTranslation } from 'react-i18next'
import { useUnits } from '@/store/useUnits'
import { useApp } from '@/store/useApp'
import { cn } from '@/lib/utils'
import { Play, Square, RotateCcw, RefreshCw, Languages } from 'lucide-react'
import i18n from '@/i18n'

export function AppHeader() {
  const { t } = useTranslation()
  const selectedFile = useApp((s) => s.selectedFile)
  const { daemonReload } = useUnits()

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'zh' : 'en'
    i18n.changeLanguage(next)
  }

  return (
    <header className="h-10 border-b border-border bg-surface flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-[10px] tracking-widest text-text-muted uppercase">
          {t('header.serviceControl')}
        </span>
        {selectedFile && (
          <span className="text-xs text-accent font-medium truncate max-w-48">
            {selectedFile}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <HeaderButton
          icon={Play}
          label={t('header.start')}
          color="text-accent hover:bg-accent-dim"
        />
        <HeaderButton
          icon={Square}
          label={t('header.stop')}
          color="text-danger hover:bg-red-500/10"
        />
        <HeaderButton
          icon={RotateCcw}
          label={t('header.restart')}
          color="text-info hover:bg-blue-500/10"
        />
        <HeaderButton
          icon={RefreshCw}
          label={t('header.daemonReload')}
          color="text-warning hover:bg-purple-500/10"
          onClick={daemonReload}
        />

        <div className="w-px h-4 bg-border mx-2" />

        <button
          onClick={toggleLang}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
        >
          <Languages size={12} />
          {i18n.language === 'en' ? '中文' : 'EN'}
        </button>
      </div>
    </header>
  )
}

function HeaderButton({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  color: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 text-[10px] rounded transition-all duration-200',
        color
      )}
      title={label}
    >
      <Icon size={12} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
