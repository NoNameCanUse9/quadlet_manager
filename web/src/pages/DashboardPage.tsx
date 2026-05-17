import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUnits } from '@/store/useUnits'
import { useContainers } from '@/store/useContainers'
import { Activity, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

export function DashboardPage() {
  const { t } = useTranslation()
  const { units, loading: unitsLoading, fetchUnits } = useUnits()
  const { containers, stats, fetchContainers, fetchStats } = useContainers()

  useEffect(() => {
    fetchUnits()
    fetchContainers()
    fetchStats()
  }, [fetchUnits, fetchContainers, fetchStats])

  const active = units.filter((u) => u.activeState === 'active').length
  const failed = units.filter((u) => u.activeState === 'failed').length
  const inactive = units.length - active - failed

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
        {t('dashboard.title')}
      </h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label={t('dashboard.totalUnits')}
          value={units.length}
          icon={Activity}
          color="text-text-primary"
        />
        <StatCard
          label={t('dashboard.running')}
          value={active}
          icon={CheckCircle}
          color="text-accent"
        />
        <StatCard
          label={t('dashboard.stopped')}
          value={inactive}
          icon={XCircle}
          color="text-text-muted"
        />
        <StatCard
          label={t('dashboard.failed')}
          value={failed}
          icon={AlertTriangle}
          color="text-danger"
        />
      </div>

      {/* Container Stats */}
      <div className="border border-border rounded bg-surface">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-[10px] tracking-widest text-text-muted uppercase">
            {t('dashboard.containerStats')}
          </h3>
        </div>
        <div className="p-3">
          {containers.length === 0 ? (
            <p className="text-xs text-text-muted">{t('dashboard.noContainers')}</p>
          ) : (
            <div className="space-y-2">
              {containers.map((c) => {
                const s = stats.find((st) => st.id === c.id)
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded bg-surface-raised text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          c.state === 'running' ? 'bg-accent' : 'bg-text-muted'
                        }`}
                      />
                      <span className="truncate text-text-primary">
                        {c.names[0] || c.id.slice(0, 12)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-text-muted">
                      {s && (
                        <>
                          <span>CPU {s.cpuPercent.toFixed(1)}%</span>
                          <span>
                            MEM {formatBytes(s.memUsage)}/{formatBytes(s.memLimit)}
                          </span>
                        </>
                      )}
                      <span className="text-text-secondary">{c.state}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Unit List */}
      <div className="border border-border rounded bg-surface">
        <div className="px-3 py-2 border-b border-border">
          <h3 className="text-[10px] tracking-widest text-text-muted uppercase">
            {t('units.title')}
          </h3>
        </div>
        <div className="p-3">
          {unitsLoading ? (
            <p className="text-xs text-text-muted">{t('common.loading')}</p>
          ) : units.length === 0 ? (
            <p className="text-xs text-text-muted">{t('units.noUnits')}</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted text-left">
                  <th className="pb-2 font-medium">{t('units.name')}</th>
                  <th className="pb-2 font-medium">{t('units.status')}</th>
                  <th className="pb-2 font-medium">{t('units.source')}</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.name} className="border-t border-border">
                    <td className="py-1.5 text-text-primary">{u.name}</td>
                    <td className="py-1.5">
                      <StatusBadge state={u.activeState} />
                    </td>
                    <td className="py-1.5 text-text-muted truncate max-w-48">
                      {u.sourcePath}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}) {
  return (
    <div className="border border-border rounded bg-surface p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          {label}
        </span>
        <Icon size={14} className={color} />
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
