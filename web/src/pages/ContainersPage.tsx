import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { RefreshCw, Play, Square, RotateCw, Pause, Trash2, Terminal } from 'lucide-react'
import {
  useContainers, useContainerStats,
  useStartContainer, useStopContainer, useRestartContainer,
  usePauseContainer, useRemoveContainer, useExecCreate,
} from '@/hooks/useContainers'
import { toast } from 'sonner'

export function ContainersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: containersData, isLoading, error, refetch } = useContainers()
  const containers = containersData ?? []
  const { data: stats } = useContainerStats()
  const startMut = useStartContainer()
  const stopMut = useStopContainer()
  const restartMut = useRestartContainer()
  const pauseMut = usePauseContainer()
  const removeMut = useRemoveContainer()
  const execMut = useExecCreate()

  const statsMap = new Map((stats?.containers || []).map(s => [s.id, s]))

  const filtered = containers.filter(c => {
    const name = c.names?.[0] || ''
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search)
    const matchesState = stateFilter === 'all' || c.state === stateFilter
    return matchesSearch && matchesState
  })

  const handleAction = async (action: () => Promise<any>, label: string) => {
    try {
      await action()
      toast.success(label)
    } catch (e: any) {
      toast.error(e.message || 'Action failed')
    }
  }

  const handleTerminal = async (id: string) => {
    try {
      const { exec_id } = await execMut.mutateAsync(id)
      navigate(`/containers/${id}/exec/${exec_id}`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create exec session')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
          {t('sidebar.containers')}
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={t('containers.searchPlaceholder') || 'Search...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary w-40"
          />
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary"
          >
            <option value="all">{t('containers.stateAll')}</option>
            <option value="running">{t('containers.stateRunning')}</option>
            <option value="exited">{t('containers.stateExited')}</option>
            <option value="paused">{t('containers.statePaused')}</option>
          </select>
          <button onClick={() => refetch()} className="p-1 text-text-secondary hover:text-text-primary">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/5 rounded px-3 py-2 text-xs text-red-400">
          {error.message}
        </div>
      )}

      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-raised text-text-secondary">
              <th className="px-3 py-2 text-left font-medium">{t('common.name')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('containers.image')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('containers.status')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('containers.cpu')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('containers.mem')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(c => {
              const name = c.names?.[0] || '-'
              const s = statsMap.get(c.id)
              const isRunning = c.state === 'running'
              return (
                <tr key={c.id} className="hover:bg-surface-raised/50">
                  <td className="px-3 py-2 text-text-primary font-mono">{name}</td>
                  <td className="px-3 py-2 text-text-secondary">{c.image}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      isRunning ? 'bg-emerald-500/10 text-emerald-400' :
                      c.state === 'paused' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-zinc-500/10 text-zinc-400'
                    }`}>
                      {c.state}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {s ? `${s.cpuPercent.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {s ? formatBytes(s.memUsage) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isRunning ? (
                        <>
                          <button onClick={() => handleAction(() => stopMut.mutateAsync(c.id), t('containers.stopped'))}
                            className="p-1 text-text-secondary hover:text-red-400" title={t('common.stop') || 'Stop'}>
                            <Square size={12} />
                          </button>
                          <button onClick={() => handleAction(() => restartMut.mutateAsync(c.id), t('containers.restarted'))}
                            className="p-1 text-text-secondary hover:text-blue-400" title={t('common.restart') || 'Restart'}>
                            <RotateCw size={12} />
                          </button>
                          <button onClick={() => handleAction(() => pauseMut.mutateAsync(c.id), t('containers.paused'))}
                            className="p-1 text-text-secondary hover:text-yellow-400" title={t('common.pause') || 'Pause'}>
                            <Pause size={12} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleAction(() => startMut.mutateAsync(c.id), t('containers.started'))}
                          className="p-1 text-text-secondary hover:text-emerald-400" title={t('common.start') || 'Start'}>
                          <Play size={12} />
                        </button>
                      )}
                      <button onClick={() => handleTerminal(c.id)}
                        className="p-1 text-text-secondary hover:text-blue-400" title={t('containers.terminal') || 'Terminal'}>
                        <Terminal size={12} />
                      </button>
                      <button onClick={() => setDeleteTarget(c.id)}
                        className="p-1 text-text-secondary hover:text-red-400" title={t('common.remove') || 'Remove'}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-4 max-w-sm w-full mx-4">
            <p className="text-sm text-text-primary mb-4">{t('containers.removeConfirm')}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised">
                {t('common.cancel')}
              </button>
              <button onClick={() => {
                handleAction(() => removeMut.mutateAsync({ id: deleteTarget, force: true }), t('containers.removed'))
                setDeleteTarget(null)
              }} className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20">
                {t('common.remove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
