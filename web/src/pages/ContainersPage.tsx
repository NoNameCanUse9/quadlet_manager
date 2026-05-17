import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useContainers } from '@/store/useContainers'
import { RefreshCw } from 'lucide-react'

export function ContainersPage() {
  const { t } = useTranslation()
  const { containers, loading, fetchContainers } = useContainers()

  useEffect(() => {
    fetchContainers()
  }, [fetchContainers])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
          {t('sidebar.containers')}
        </h2>
        <button
          onClick={fetchContainers}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
        >
          <RefreshCw size={12} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="border border-border rounded bg-surface overflow-hidden">
        {loading ? (
          <div className="p-4 text-xs text-text-muted">{t('common.loading')}</div>
        ) : containers.length === 0 ? (
          <div className="p-4 text-xs text-text-muted">{t('dashboard.noContainers')}</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted text-left border-b border-border bg-surface-raised">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Image</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border hover:bg-surface-raised transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-text-muted">
                    {c.id.slice(0, 12)}
                  </td>
                  <td className="px-3 py-2 text-text-primary">
                    {c.names[0] || '-'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{c.image}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                        c.state === 'running'
                          ? 'bg-accent-dim text-accent'
                          : 'bg-surface-raised text-text-muted'
                      }`}
                    >
                      {c.state}
                    </span>
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
