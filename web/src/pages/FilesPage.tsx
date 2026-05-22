import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/useApp'
import { api } from '@/api/client'
import { toast } from 'sonner'
import { FileEditDialog } from '@/components/editor/FileEditDialog'
import { useUnits } from '@/store/useUnits'
import {
  Save,
  Play,
  Trash2,
  RefreshCw,
  Plus,
  Square,
  RotateCcw,
  Power,
  PowerOff,
} from 'lucide-react'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/lib/utils'

export function FilesPage() {
  const { t } = useTranslation()
  const { files, fetchFiles } = useApp()
  const { units, error, fetchUnits, startUnit, stopUnit, restartUnit, enableUnit, disableUnit } = useUnits()
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newFilename, setNewFilename] = useState('')
  const [newExtension, setNewExtension] = useState('.container')
  const [editFile, setEditFile] = useState<string | null>(null)

  useEffect(() => {
    fetchFiles()
    fetchUnits()
  }, [fetchFiles, fetchUnits])

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`${t('files.confirmDelete') || 'Are you sure you want to delete this file?'} (${filename})`)) return
    try {
      await api.deleteFile(filename)
      await fetchFiles()
      await fetchUnits()
      toast.success(t('common.success') || 'Success')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleCreate = async () => {
    const baseName = newFilename.trim()
    if (!baseName) return
    const fullName = baseName.endsWith(newExtension) ? baseName : `${baseName}${newExtension}`
    try {
      await api.createFile(fullName, '')
      setShowCreate(false)
      setNewFilename('')
      await fetchFiles()
      await fetchUnits()
      setEditFile(fullName)
      toast.success(t('common.success') || 'Success')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleAction = async (name: string, action: () => Promise<void>) => {
    setActionLoading(name)
    try {
      await action()
      toast.success(t('files.actionSuccess') || 'Success')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDialogSaved = async () => {
    await fetchFiles()
    await fetchUnits()
  }

  const handleDialogDeleted = async () => {
    setEditFile(null)
    await fetchFiles()
    await fetchUnits()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold tracking-wider text-text-primary uppercase">
          {t('files.title') || 'Quadlet'}
        </h2>
        <div className="flex items-center gap-2">
          {actionLoading && <LoadingSpinner />}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm bg-accent text-background rounded hover:bg-accent/90 transition-all font-semibold"
          >
            <Plus size={16} />
            {t('files.create') || 'Create'}
          </button>
          <button
            onClick={async () => {
              await fetchFiles()
              await fetchUnits()
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-text-secondary hover:text-text-primary border border-border rounded bg-surface hover:bg-surface-raised transition-colors font-semibold"
          >
            <RefreshCw size={14} />
            {t('common.refresh') || 'Refresh'}
          </button>
        </div>
      </div>

      <ErrorBanner message={error} />

      {/* Main List Table */}
      <div className="border border-border rounded bg-surface overflow-hidden">
        {files.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted font-medium">
            {t('files.noData') || 'No Quadlet configurations found. Click "Create" to get started!'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-raised text-text-secondary border-b border-border">
                <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('files.name') || 'Name'}</th>
                <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('files.type') || 'Type'}</th>
                <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('files.status') || 'Status'}</th>
                <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('files.substate') || 'Systemd Substate'}</th>
                <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider">{t('files.actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {files.map((f) => {
                const uName = filenameToUnitName(f.name)
                const unit = units.find((u) => u.name === uName)

                return (
                  <tr
                    key={f.name}
                    className="hover:bg-surface-raised/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditFile(f.name)}
                        className="text-accent font-semibold hover:underline font-mono text-left"
                      >
                        {f.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-text-muted">{f.type}</td>
                    <td className="px-4 py-3">
                      {unit ? (
                        <StatusBadge state={unit.activeState} />
                      ) : (
                        <span className="text-text-muted italic font-medium">{t('files.notDeployed') || 'Not deployed'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-text-secondary font-medium">
                      {unit?.subState || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {unit ? (
                          <>
                            {unit.activeState !== 'active' ? (
                              <ActionBtn
                                icon={Play}
                                color="text-accent hover:bg-accent-dim animate-pulse"
                                loading={actionLoading === unit.name}
                                onClick={() => handleAction(unit.name, () => startUnit(unit.name))}
                                title={t('header.start') || 'Start'}
                              />
                            ) : (
                              <ActionBtn
                                icon={Square}
                                color="text-danger hover:bg-red-500/10"
                                loading={actionLoading === unit.name}
                                onClick={() => handleAction(unit.name, () => stopUnit(unit.name))}
                                title={t('header.stop') || 'Stop'}
                              />
                            )}
                            <ActionBtn
                              icon={RotateCcw}
                              color="text-info hover:bg-blue-500/10"
                              loading={actionLoading === unit.name}
                              onClick={() => handleAction(unit.name, () => restartUnit(unit.name))}
                              title={t('header.restart') || 'Restart'}
                            />
                            <ActionBtn
                              icon={Power}
                              color="text-accent hover:bg-accent-dim"
                              loading={actionLoading === unit.name}
                              onClick={() => handleAction(unit.name, () => enableUnit(unit.name))}
                              title={t('header.enableOnBoot') || 'Enable on Boot'}
                            />
                            <ActionBtn
                              icon={PowerOff}
                              color="text-text-muted hover:bg-surface-raised"
                              loading={actionLoading === unit.name}
                              onClick={() => handleAction(unit.name, () => disableUnit(unit.name))}
                              title={t('header.disableOnBoot') || 'Disable on Boot'}
                            />
                          </>
                        ) : (
                          <button
                            onClick={async () => {
                              try {
                                const fileContent = await api.readFile(f.name)
                                await api.applyFile(f.name, fileContent.content)
                                toast.success(t('common.success') || 'Deployed successfully')
                                await fetchUnits()
                              } catch (e) {
                                toast.error((e as Error).message)
                              }
                            }}
                            className="px-3 py-1 text-xs font-semibold bg-accent-dim text-accent rounded hover:bg-accent/20 transition-all mr-1"
                          >
                            {t('files.deploy') || 'Deploy'}
                          </button>
                        )}
                        <span className="w-[1px] h-4 bg-border mx-1.5" />
                        <ActionBtn
                          icon={Save}
                          color="text-text-secondary hover:text-accent hover:bg-accent-dim"
                          loading={false}
                          onClick={() => setEditFile(f.name)}
                          title={t('files.editor') || 'Edit'}
                        />
                        <ActionBtn
                          icon={Trash2}
                          color="text-text-muted hover:text-danger hover:bg-red-500/10"
                          loading={false}
                          onClick={() => handleDeleteFile(f.name)}
                          title={t('files.delete') || 'Delete'}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Creation Dialog Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                {t('files.createTitle') || 'Create New Quadlet'}
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="text-text-muted hover:text-text-primary text-sm font-semibold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-text-muted uppercase tracking-wider font-semibold">
                  {t('files.filename') || 'Filename'}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="nginx"
                    className="flex-1 bg-surface-raised border border-border rounded px-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    autoFocus
                  />
                  <select
                    value={newExtension}
                    onChange={(e) => setNewExtension(e.target.value)}
                    className="bg-surface-raised border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent font-mono cursor-pointer"
                  >
                    <option value=".container">.container</option>
                    <option value=".volume">.volume</option>
                    <option value=".network">.network</option>
                    <option value=".pod">.pod</option>
                    <option value=".kube">.kube</option>
                    <option value=".image">.image</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 text-sm pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary font-semibold"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-accent text-background rounded hover:bg-accent/90 transition-colors font-bold"
              >
                {t('common.create') || 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editFile && (
        <FileEditDialog
          filename={editFile}
          onClose={() => setEditFile(null)}
          onSaved={handleDialogSaved}
          onDeleted={handleDialogDeleted}
        />
      )}
    </div>
  )
}

function filenameToUnitName(filename: string): string {
  const extIndex = filename.lastIndexOf('.')
  if (extIndex < 0) return ''
  const base = filename.substring(0, extIndex)
  const suffix = filename.substring(extIndex + 1)
  switch (suffix) {
    case 'container':
      return `${base}.service`
    case 'volume':
      return `${base}-volume.service`
    case 'network':
      return `${base}-network.service`
    case 'pod':
      return `${base}-pod.service`
    case 'kube':
      return `${base}-kube.service`
    case 'image':
      return `${base}-image.service`
    default:
      return ''
  }
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
        'p-2 rounded transition-all duration-200 disabled:opacity-50',
        color
      )}
    >
      <Icon size={14} />
    </button>
  )
}

function StatusBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    active: 'bg-accent-dim text-accent border border-accent/20',
    inactive: 'bg-surface-raised text-text-muted border border-border',
    failed: 'bg-red-500/10 text-danger border border-red-500/20',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
        colors[state] || colors.inactive
      }`}
    >
      {state}
    </span>
  )
}
