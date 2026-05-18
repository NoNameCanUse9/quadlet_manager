import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/useApp'
import { api } from '@/api/client'
import { toast } from 'sonner'
import { QuadletEditor } from '@/components/editor/QuadletEditor'
import { ViewToggle } from '@/components/editor/ViewToggle'
import {
  ConfigWizard,
  wizardToQuadlet,
  quadletToWizard,
  type WizardData,
} from '@/components/wizard/ConfigWizard'
import { useUnits } from '@/store/useUnits'
import {
  Save,
  Play,
  Trash2,
  RefreshCw,
  Plus,
  CheckCircle,
  AlertTriangle,
  Square,
  RotateCcw,
  Power,
  PowerOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export function FilesPage() {
  const { t } = useTranslation()
  const { files, fetchFiles, selectedFile, selectFile } = useApp()
  const { units, error, fetchUnits, startUnit, stopUnit, restartUnit, enableUnit, disableUnit } = useUnits()
  const [content, setContent] = useState('')
  const [wizardData, setWizardData] = useState<WizardData | null>(null)
  const [mode, setMode] = useState<'wizard' | 'editor'>('editor')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [validation, setValidation] = useState<{
    valid: boolean
    warnings?: string[]
  } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newFilename, setNewFilename] = useState('')
  const [newExtension, setNewExtension] = useState('.container')

  useEffect(() => {
    fetchFiles()
    fetchUnits()
  }, [fetchFiles, fetchUnits])

  // Load file content when selected
  useEffect(() => {
    if (!selectedFile) {
      setContent('')
      setWizardData(null)
      return
    }
    api.readFile(selectedFile).then((res) => {
      setContent(res.content)
      setWizardData(quadletToWizard(res.content))
    })
  }, [selectedFile])

  // Sync wizard -> editor
  const handleWizardChange = useCallback(
    (data: WizardData) => {
      setWizardData(data)
      setContent(wizardToQuadlet(data, selectedFile?.replace(/\.[^.]+$/, '') || 'container'))
    },
    [selectedFile]
  )

  // Sync editor -> wizard (on mode switch)
  const handleModeChange = useCallback(
    (newMode: 'wizard' | 'editor') => {
      if (newMode === 'wizard' && content) {
        setWizardData(quadletToWizard(content))
      }
      setMode(newMode)
    },
    [content]
  )

  const handleSave = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      await api.updateFile(selectedFile, content)
      toast.success(t('common.success') || 'Success')
    } catch (e) {
      toast.error((e as Error).message)
    }
    setSaving(false)
  }

  const handleApply = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      await api.applyFile(selectedFile, content)
      toast.success(t('common.success') || 'Success')
      await fetchUnits()
    } catch (e) {
      toast.error((e as Error).message)
    }
    setSaving(false)
  }

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`${t('files.confirmDelete') || 'Are you sure you want to delete this file?'} (${filename})`)) return
    try {
      await api.deleteFile(filename)
      if (selectedFile === filename) {
        selectFile(null)
      }
      await fetchFiles()
      await fetchUnits()
      toast.success(t('common.success') || 'Success')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleValidate = async () => {
    try {
      const res = await api.validateFile(content)
      setValidation(res)
    } catch (e) {
      setValidation({ valid: false, warnings: [(e as Error).message] })
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
      selectFile(fullName)
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

  const unitName = selectedFile ? filenameToUnitName(selectedFile) : ''
  const currentUnit = units.find((u) => u.name === unitName)

  // Determine which view to show
  const view = selectedFile ? 'editor' : 'list'

  if (view === 'list') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
            {t('files.title') || 'Quadlet'}
          </h2>
          <div className="flex items-center gap-2">
            {actionLoading && <LoadingSpinner />}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent text-background rounded hover:bg-accent/90 transition-all font-semibold"
            >
              <Plus size={14} />
              {t('files.create') || 'Create'}
            </button>
            <button
              onClick={async () => {
                await fetchFiles()
                await fetchUnits()
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border rounded bg-surface hover:bg-surface-raised transition-colors"
            >
              <RefreshCw size={12} />
              {t('common.refresh') || 'Refresh'}
            </button>
          </div>
        </div>

        <ErrorBanner message={error} />

        {/* Main List Table */}
        <div className="border border-border rounded bg-surface overflow-hidden">
          {files.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted font-medium">
              {t('files.noData') || 'No Quadlet configurations found. Click "Create" to get started!'}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted text-left border-b border-border bg-surface-raised font-semibold">
                  <th className="px-4 py-3 font-medium">{t('files.name') || 'Name'}</th>
                  <th className="px-4 py-3 font-medium">{t('files.type') || 'Type'}</th>
                  <th className="px-4 py-3 font-medium">{t('files.status') || 'Status'}</th>
                  <th className="px-4 py-3 font-medium">{t('files.substate') || 'Systemd Substate'}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('files.actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const uName = filenameToUnitName(f.name)
                  const unit = units.find((u) => u.name === uName)

                  return (
                    <tr
                      key={f.name}
                      className="border-b border-border hover:bg-surface-raised transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => selectFile(f.name)}
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
                          <span className="text-text-muted italic">{t('files.notDeployed') || 'Not deployed'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">
                        {unit?.subState || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {unit ? (
                            <>
                              {unit.activeState !== 'active' ? (
                                <ActionBtn
                                  icon={Play}
                                  color="text-accent hover:bg-accent-dim"
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
                              className="px-2 py-0.5 text-[10px] font-semibold bg-accent-dim text-accent rounded hover:bg-accent/20 transition-all mr-1"
                            >
                              {t('files.deploy') || 'Deploy'}
                            </button>
                          )}
                          <span className="w-[1px] h-3 bg-border mx-1" />
                          <ActionBtn
                            icon={Save}
                            color="text-text-secondary hover:text-accent hover:bg-accent-dim"
                            loading={false}
                            onClick={() => selectFile(f.name)}
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
            <div className="bg-surface border border-border rounded-lg shadow-xl max-w-sm w-full p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  {t('files.createTitle') || 'Create New Quadlet'}
                </h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-text-muted hover:text-text-primary text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                    {t('files.filename') || 'Filename'}
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newFilename}
                      onChange={(e) => setNewFilename(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                      placeholder="nginx"
                      className="flex-1 bg-surface-raised border border-border rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                      autoFocus
                    />
                    <select
                      value={newExtension}
                      onChange={(e) => setNewExtension(e.target.value)}
                      className="bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent font-mono cursor-pointer"
                    >
                      <option value=".container font-mono">.container</option>
                      <option value=".volume font-mono">.volume</option>
                      <option value=".network font-mono">.network</option>
                      <option value=".pod font-mono">.pod</option>
                      <option value=".kube font-mono">.kube</option>
                      <option value=".image font-mono">.image</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 text-xs pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 border border-border rounded hover:bg-surface-raised transition-colors text-text-secondary"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleCreate}
                  className="px-3 py-1.5 bg-accent text-background rounded hover:bg-accent/90 transition-colors font-semibold"
                >
                  {t('common.create') || 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Header toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => selectFile(null)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary border border-border rounded bg-surface hover:bg-surface-raised transition-colors font-semibold"
          >
            {t('files.backToList') || '← Back to List'}
          </button>
          <span className="text-xs text-accent font-mono font-semibold">{selectedFile}</span>
          <ViewToggle mode={mode} onChange={handleModeChange} />
        </div>
        <div className="flex items-center gap-1.5">
          {validation && (
            <span
              className={cn(
                'flex items-center gap-1 text-[10px] mr-2',
                validation.valid ? 'text-accent' : 'text-danger'
              )}
            >
              {validation.valid ? (
                <CheckCircle size={10} />
              ) : (
                <AlertTriangle size={10} />
              )}
              {validation.valid ? t('files.valid') : t('files.invalid')}
            </span>
          )}
          <ToolbarBtn
            icon={CheckCircle}
            label={t('files.validate')}
            color="text-info hover:bg-blue-500/10"
            onClick={handleValidate}
          />
          <ToolbarBtn
            icon={Save}
            label={t('files.save')}
            color="text-accent hover:bg-accent-dim"
            onClick={handleSave}
            disabled={saving}
          />
          <ToolbarBtn
            icon={Play}
            label={t('files.apply')}
            color="text-warning hover:bg-purple-500/10"
            onClick={handleApply}
            disabled={saving}
          />
          <ToolbarBtn
            icon={Trash2}
            label={t('files.delete')}
            color="text-danger hover:bg-red-500/10"
            onClick={() => handleDeleteFile(selectedFile!)}
          />
        </div>
      </div>

      {/* Validation warnings */}
      {validation?.warnings && validation.warnings.length > 0 && (
        <div className="px-3 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded text-[10px] text-yellow-400 font-medium">
          {validation.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {/* Systemd service status banner */}
      {selectedFile && (
        <div className="px-3 py-2 bg-surface border border-border rounded flex flex-col md:flex-row md:items-center justify-between text-xs gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted">{t('files.systemdService') || 'Systemd Service'}:</span>
              <span className="font-mono text-text-primary font-semibold">
                {unitName || 'unknown'}
              </span>
            </div>
            {currentUnit ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-text-muted">{t('units.status') || 'Status'}:</span>
                  <StatusBadge state={currentUnit.activeState} />
                </div>
                {currentUnit.loadState === 'loaded' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted">{t('files.activeSubstate') || 'Active Substate'}:</span>
                    <span className="text-text-secondary font-medium">{currentUnit.subState}</span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-yellow-500 font-medium flex items-center gap-1">
                <AlertTriangle size={10} />
                {t('files.notDeployed') || 'Not deployed to systemd yet'}
              </span>
            )}
          </div>

          {currentUnit ? (
            <div className="flex items-center gap-1 self-end md:self-auto">
              {currentUnit.activeState !== 'active' ? (
                <ActionBtn
                  icon={Play}
                  color="text-accent hover:bg-accent-dim"
                  loading={actionLoading === currentUnit.name}
                  onClick={() => handleAction(currentUnit.name, () => startUnit(currentUnit.name))}
                  title={t('header.start') || 'Start'}
                />
              ) : (
                <ActionBtn
                  icon={Square}
                  color="text-danger hover:bg-red-500/10"
                  loading={actionLoading === currentUnit.name}
                  onClick={() => handleAction(currentUnit.name, () => stopUnit(currentUnit.name))}
                  title={t('header.stop') || 'Stop'}
                />
              )}
              <ActionBtn
                icon={RotateCcw}
                color="text-info hover:bg-blue-500/10"
                loading={actionLoading === currentUnit.name}
                onClick={() => handleAction(currentUnit.name, () => restartUnit(currentUnit.name))}
                title={t('header.restart') || 'Restart'}
              />
              <ActionBtn
                icon={Power}
                color="text-accent hover:bg-accent-dim"
                loading={actionLoading === currentUnit.name}
                onClick={() => handleAction(currentUnit.name, () => enableUnit(currentUnit.name))}
                title={t('header.enableOnBoot') || 'Enable on Boot'}
              />
              <ActionBtn
                icon={PowerOff}
                color="text-text-muted hover:bg-surface-raised"
                loading={actionLoading === currentUnit.name}
                onClick={() => handleAction(currentUnit.name, () => disableUnit(currentUnit.name))}
                title={t('header.disableOnBoot') || 'Disable on Boot'}
              />
            </div>
          ) : (
            <button
              onClick={handleApply}
              disabled={saving}
              className="px-2.5 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 rounded text-[10px] font-semibold transition-all duration-200 self-end md:self-auto"
            >
              {t('files.deployAndStart') || 'Deploy & Start Service'}
            </button>
          )}
        </div>
      )}

      {/* Editor Content Workspace */}
      {mode === 'wizard' && wizardData ? (
        <div className="flex-1 overflow-auto border border-border rounded bg-surface p-4">
          <ConfigWizard value={wizardData} onChange={handleWizardChange} />
        </div>
      ) : (
        <QuadletEditor
          value={content}
          onChange={setContent}
          className="flex-1 border border-border rounded overflow-hidden"
        />
      )}
    </div>
  )
}

function ToolbarBtn({
  icon: Icon,
  label,
  color,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  color: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 text-[10px] rounded transition-all duration-200 disabled:opacity-50',
        color
      )}
    >
      <Icon size={12} />
      <span className="hidden lg:inline">{label}</span>
    </button>
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
        'p-1.5 rounded transition-all duration-200 disabled:opacity-50',
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
    failed: 'bg-red-500/10 text-danger border border-red-500/20',
  }
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
        colors[state] || colors.inactive
      }`}
    >
      {state}
    </span>
  )
}
