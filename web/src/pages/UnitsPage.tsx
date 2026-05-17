import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUnits } from '@/store/useUnits'
import { useApp } from '@/store/useApp'
import { Play, Square, RotateCcw, RefreshCw, Power, PowerOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export function UnitsPage() {
  const { t } = useTranslation()
  const { units, loading, fetchUnits, startUnit, stopUnit, restartUnit, enableUnit, disableUnit } =
    useUnits()
  const selectFile = useApp((s) => s.selectFile)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchUnits()
  }, [fetchUnits])

  const handleAction = async (name: string, action: () => Promise<void>) => {
    setActionLoading(name)
    try {
      await action()
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
          {t('units.title')}
        </h2>
        <button
          onClick={fetchUnits}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
        >
          <RefreshCw size={12} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="border border-border rounded bg-surface overflow-hidden">
        {loading ? (
          <div className="p-4 text-xs text-text-muted">{t('common.loading')}</div>
        ) : units.length === 0 ? (
          <div className="p-4 text-xs text-text-muted">{t('units.noUnits')}</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted text-left border-b border-border bg-surface-raised">
                <th className="px-3 py-2 font-medium">{t('units.name')}</th>
                <th className="px-3 py-2 font-medium">{t('units.status')}</th>
                <th className="px-3 py-2 font-medium">{t('units.source')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('units.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr
                  key={u.name}
                  className="border-b border-border hover:bg-surface-raised transition-colors"
                >
                  <td className="px-3 py-2">
                    <button
                      onClick={() => selectFile(u.sourcePath)}
                      className="text-accent hover:underline"
                    >
                      {u.name}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge state={u.activeState} />
                  </td>
                  <td className="px-3 py-2 text-text-muted truncate max-w-48">
                    {u.sourcePath}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {u.activeState !== 'active' ? (
                        <ActionBtn
                          icon={Play}
                          color="text-accent hover:bg-accent-dim"
                          loading={actionLoading === u.name}
                          onClick={() => handleAction(u.name, () => startUnit(u.name))}
                          title={t('header.start')}
                        />
                      ) : (
                        <ActionBtn
                          icon={Square}
                          color="text-danger hover:bg-red-500/10"
                          loading={actionLoading === u.name}
                          onClick={() => handleAction(u.name, () => stopUnit(u.name))}
                          title={t('header.stop')}
                        />
                      )}
                      <ActionBtn
                        icon={RotateCcw}
                        color="text-info hover:bg-blue-500/10"
                        loading={actionLoading === u.name}
                        onClick={() => handleAction(u.name, () => restartUnit(u.name))}
                        title={t('header.restart')}
                      />
                      <ActionBtn
                        icon={Power}
                        color="text-accent hover:bg-accent-dim"
                        loading={actionLoading === u.name}
                        onClick={() => handleAction(u.name, () => enableUnit(u.name))}
                        title={t('header.enableOnBoot')}
                      />
                      <ActionBtn
                        icon={PowerOff}
                        color="text-text-muted hover:bg-surface-raised"
                        loading={actionLoading === u.name}
                        onClick={() => handleAction(u.name, () => disableUnit(u.name))}
                        title={t('header.disableOnBoot') || 'Disable'}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ActionBtn({
  icon: Icon,
  color,
  loading,
  onClick,
  title,
}: {
  icon: React.ComponentType<{ size?: number }>
  color: string
  loading: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      className={cn(
        'p-1 rounded transition-all duration-200 disabled:opacity-50',
        color
      )}
    >
      <Icon size={12} />
    </button>
  )
}

function StatusBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    active: 'bg-accent-dim text-accent',
    inactive: 'bg-surface-raised text-text-muted',
    failed: 'bg-red-500/10 text-danger',
  }
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
        colors[state] || colors.inactive
      }`}
    >
      {state}
    </span>
  )
}
