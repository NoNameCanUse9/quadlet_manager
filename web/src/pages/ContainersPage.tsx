import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { RefreshCw, Play, Square, RotateCw, Pause, Trash2, Terminal, Plus, Upload, ArrowRightLeft } from 'lucide-react'
import {
  useContainers, useContainerStats,
  useStartContainer, useStopContainer, useRestartContainer,
  usePauseContainer, useRemoveContainer, useExecCreate,
  useSetAutostart,
} from '@/hooks/useContainers'
import { useConvertCompose } from '@/hooks/useCompose'
import { ImportComposeDialog } from '@/components/compose/ImportComposeDialog'
import { ConvertPreviewDialog } from '@/components/compose/ConvertPreviewDialog'
import { CreateContainerDialog } from '@/components/container/CreateContainerDialog'
import { toast } from 'sonner'
import type { QuadletConversion } from '@/api/client'

function getContainerType(labels?: Record<string, string>): 'quadlet' | 'compose' | 'podman' {
  if (labels?.['io.containers.systemd.unit']) return 'quadlet'
  if (labels?.['com.docker.compose.project']) return 'compose'
  return 'podman'
}

function getComposeProject(labels?: Record<string, string>): string | undefined {
  return labels?.['com.docker.compose.project']
}

const typeColors = {
  quadlet: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  compose: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  podman: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
}

export function ContainersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [convertTarget, setConvertTarget] = useState<string | null>(null)
  const [conversions, setConversions] = useState<QuadletConversion[]>([])

  const { data: containersData, isLoading, error, refetch } = useContainers()
  const containers = containersData ?? []
  const { data: stats } = useContainerStats()
  const startMut = useStartContainer()
  const stopMut = useStopContainer()
  const restartMut = useRestartContainer()
  const pauseMut = usePauseContainer()
  const removeMut = useRemoveContainer()
  const execMut = useExecCreate()
  const setAutostartMut = useSetAutostart()
  const convertMut = useConvertCompose()

  const statsMap = new Map((stats?.containers || []).map(s => [s.id, s]))

  const filtered = containers.filter(c => {
    const name = c.names?.[0] || ''
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search)
    const matchesState = stateFilter === 'all' || c.state === stateFilter
    const type = getContainerType(c.labels)
    const matchesSource = sourceFilter === 'all' || type === sourceFilter
    return matchesSearch && matchesState && matchesSource
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

  const handleConvert = async (name: string) => {
    try {
      const result = await convertMut.mutateAsync(name)
      setConversions(result)
      setConvertTarget(name)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-base font-bold tracking-wider text-text-primary uppercase">
          {t('sidebar.containers')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder={t('containers.searchPlaceholder') || 'Search...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary w-44 placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="all">{t('containers.stateAll')}</option>
            <option value="running">{t('containers.stateRunning')}</option>
            <option value="exited">{t('containers.stateExited')}</option>
            <option value="paused">{t('containers.statePaused')}</option>
          </select>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="all">{t('containers.sourceAll')}</option>
            <option value="quadlet">{t('containers.typeQuadlet')}</option>
            <option value="compose">{t('containers.typeCompose')}</option>
            <option value="podman">{t('containers.typePodman')}</option>
          </select>
          <button onClick={() => refetch()} className="p-1.5 text-text-secondary hover:text-text-primary transition-colors">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary border border-border rounded hover:bg-surface-raised transition-colors font-semibold"
          >
            <Upload size={14} />
            {t('compose.import')}
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 rounded transition-colors font-semibold"
          >
            <Plus size={14} />
            {t('containers.createContainer')}
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-500/5 rounded px-4 py-2.5 text-sm text-red-400">
          {error.message}
        </div>
      )}

      {/* Main List Table */}
      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-raised text-text-secondary border-b border-border">
              <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('common.name')}</th>
              <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('containers.source')}</th>
              <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('containers.image')}</th>
              <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('containers.status')}</th>
              <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider">{t('containers.cpu')}</th>
              <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider">{t('containers.mem')}</th>
              <th className="px-4 py-3 text-center font-semibold text-text-muted text-xs uppercase tracking-wider">{t('containers.autostart')}</th>
              <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(c => {
              const name = c.names?.[0] || '-'
              const s = statsMap.get(c.id)
              const isRunning = c.state === 'running'
              const type = getContainerType(c.labels)
              const composeProject = getComposeProject(c.labels)
              return (
                <tr key={c.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-3 text-text-primary font-mono font-semibold">{name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[type]}`}>
                      {type === 'quadlet' ? t('containers.typeQuadlet') :
                       type === 'compose' ? `${t('containers.typeCompose')}${composeProject ? ` (${composeProject})` : ''}` :
                       t('containers.typePodman')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary font-mono">{c.image}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                      isRunning ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      c.state === 'paused' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                    }`}>
                      {c.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono font-medium">
                    {s ? `${s.cpuPercent.toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono font-medium">
                    {s ? formatBytes(s.memUsage) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {type === 'quadlet' ? (
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={async (e) => {
                          try {
                            await setAutostartMut.mutateAsync({ id: c.id, enabled: e.target.checked })
                            toast.success(e.target.checked ? t('containers.autostartEnabled') : t('containers.autostartDisabled'))
                          } catch (err: any) {
                            toast.error(err.message)
                          }
                        }}
                        className="accent-emerald-500 cursor-pointer w-4 h-4 rounded"
                      />
                    ) : (
                      <span className="text-text-secondary font-medium">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isRunning ? (
                        <>
                          <button onClick={() => handleAction(() => stopMut.mutateAsync(c.id), t('containers.stopped'))}
                            className="p-1.5 text-text-secondary hover:text-red-400 transition-colors" title={t('common.stop') || 'Stop'}>
                            <Square size={14} />
                          </button>
                          <button onClick={() => handleAction(() => restartMut.mutateAsync(c.id), t('containers.restarted'))}
                            className="p-1.5 text-text-secondary hover:text-blue-400 transition-colors" title={t('common.restart') || 'Restart'}>
                            <RotateCw size={14} />
                          </button>
                          <button onClick={() => handleAction(() => pauseMut.mutateAsync(c.id), t('containers.paused'))}
                            className="p-1.5 text-text-secondary hover:text-yellow-400 transition-colors" title={t('common.pause') || 'Pause'}>
                            <Pause size={14} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleAction(() => startMut.mutateAsync(c.id), t('containers.started'))}
                          className="p-1.5 text-text-secondary hover:text-emerald-400 transition-colors" title={t('common.start') || 'Start'}>
                          <Play size={14} />
                        </button>
                      )}
                      <button onClick={() => handleTerminal(c.id)}
                        className="p-1.5 text-text-secondary hover:text-blue-400 transition-colors" title={t('containers.terminal') || 'Terminal'}>
                        <Terminal size={14} />
                      </button>
                      {type === 'compose' && composeProject && (
                        <button onClick={() => handleConvert(composeProject)}
                          className="p-1.5 text-text-secondary hover:text-purple-400 transition-colors" title={t('compose.convert') || 'Convert'}>
                          <ArrowRightLeft size={14} />
                        </button>
                      )}
                      <button onClick={() => setDeleteTarget(c.id)}
                        className="p-1.5 text-text-secondary hover:text-red-400 transition-colors" title={t('common.remove') || 'Remove'}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-secondary font-medium">
                  {t('containers.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Container Dialog */}
      <CreateContainerDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetch()}
      />

      {/* Import Compose Dialog */}
      <ImportComposeDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Convert Preview Dialog */}
      <ConvertPreviewDialog
        open={convertTarget !== null}
        onClose={() => { setConvertTarget(null); setConversions([]) }}
        conversions={conversions}
        projectName={convertTarget || ''}
        onApplied={() => refetch()}
      />

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              {t('common.remove') || 'Remove'}
            </h3>
            <p className="text-sm text-text-secondary">{t('containers.removeConfirm')}</p>
            <div className="flex justify-end gap-2 text-sm pt-2">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary">
                {t('common.cancel')}
              </button>
              <button onClick={() => {
                handleAction(() => removeMut.mutateAsync({ id: deleteTarget, force: true }), t('containers.removed'))
                setDeleteTarget(null)
              }} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors font-semibold">
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
