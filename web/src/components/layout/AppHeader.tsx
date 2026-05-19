import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useUnits } from '@/store/useUnits'
import { useApp } from '@/store/useApp'
import { cn } from '@/lib/utils'
import { api, type UpdateInfo } from '@/api/client'
import { Play, Square, RotateCcw, RefreshCw, Languages, ArrowUpCircle } from 'lucide-react'
import i18n from '@/i18n'
import { useState, useRef, useEffect } from 'react'

export function AppHeader() {
  const { t } = useTranslation()
  const selectedFile = useApp((s) => s.selectedFile)
  const { daemonReload } = useUnits()
  const [showUpdate, setShowUpdate] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const { data: updateInfo } = useQuery<UpdateInfo>({
    queryKey: ['update-info'],
    queryFn: api.getUpdateInfo,
    refetchInterval: 30 * 60 * 1000, // 30 minutes
    retry: false,
  })

  const hasUpdate = updateInfo?.hasUpdate ?? false

  // Close popover on outside click
  useEffect(() => {
    if (!showUpdate) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowUpdate(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showUpdate])

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'zh' : 'en'
    i18n.changeLanguage(next)
  }

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 flex-shrink-0 transition-all duration-200">
      {/* Service Control Section */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-bold tracking-widest text-text-muted uppercase">
          {t('header.serviceControl')}
        </span>
        {selectedFile && (
          <span className="text-sm text-accent font-semibold truncate max-w-64 bg-accent/5 border border-accent/20 rounded px-2.5 py-0.5 font-mono">
            {selectedFile}
          </span>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5">
        <HeaderButton
          icon={Play}
          label={t('header.start')}
          color="text-accent hover:bg-accent-dim hover:text-accent"
        />
        <HeaderButton
          icon={Square}
          label={t('header.stop')}
          color="text-danger hover:bg-red-500/10 hover:text-red-400"
        />
        <HeaderButton
          icon={RotateCcw}
          label={t('header.restart')}
          color="text-info hover:bg-blue-500/10 hover:text-blue-400"
        />
        <HeaderButton
          icon={RefreshCw}
          label={t('header.daemonReload')}
          color="text-warning hover:bg-purple-500/10 hover:text-yellow-400"
          onClick={daemonReload}
        />

        <div className="w-px h-5 bg-border mx-3.5" />

        {/* Update Notification */}
        {hasUpdate && (
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowUpdate(!showUpdate)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/10 rounded transition-all"
              title={t('header.updateAvailable')}
            >
              <ArrowUpCircle size={14} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
            </button>
            {showUpdate && updateInfo && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-surface-raised border border-border rounded-lg shadow-lg p-4 z-50">
                <p className="text-sm font-semibold text-text-primary mb-1">
                  {t('settings.about.hasUpdate')}
                </p>
                <p className="text-xs text-text-muted mb-3">
                  v{updateInfo.current} → {updateInfo.latest}
                </p>
                <a
                  href={updateInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-3 py-1.5 text-xs font-semibold rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                >
                  {t('settings.about.goToDownload')}
                </a>
              </div>
            )}
          </div>
        )}

        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-primary border border-border/30 rounded hover:bg-surface-raised transition-all"
        >
          <Languages size={14} />
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
        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-transparent transition-all duration-200',
        color
      )}
      title={label}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
