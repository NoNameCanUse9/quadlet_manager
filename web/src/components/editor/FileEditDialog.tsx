import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { toast } from 'sonner'
import { QuadletEditor } from './QuadletEditor'
import { ViewToggle } from './ViewToggle'
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
  CheckCircle,
  AlertTriangle,
  Square,
  RotateCcw,
  Power,
  PowerOff,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileEditDialogProps {
  filename: string
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export function FileEditDialog({ filename, onClose, onSaved, onDeleted }: FileEditDialogProps) {
  const { t } = useTranslation()
  const { units, fetchUnits, startUnit, stopUnit, restartUnit, enableUnit, disableUnit } = useUnits()
  const [content, setContent] = useState('')
  const [wizardData, setWizardData] = useState<WizardData | null>(null)
  const [mode, setMode] = useState<'wizard' | 'editor'>('editor')
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [validation, setValidation] = useState<{
    valid: boolean
    warnings?: string[]
  } | null>(null)

  const unitName = filenameToUnitName(filename)
  const currentUnit = units.find((u) => u.name === unitName)

  useEffect(() => {
    api.readFile(filename).then((res) => {
      setContent(res.content)
      setWizardData(quadletToWizard(res.content))
    })
    fetchUnits()
  }, [filename, fetchUnits])

  // Sync wizard -> editor
  const handleWizardChange = useCallback((data: WizardData) => {
    setWizardData(data)
    setContent(wizardToQuadlet(data))
  }, [])

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
    setSaving(true)
    try {
      await api.updateFile(filename, content)
      toast.success(t('common.success') || 'Success')
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    }
    setSaving(false)
  }

  const handleApply = async () => {
    setSaving(true)
    try {
      await api.applyFile(filename, content)
      toast.success(t('common.success') || 'Success')
      await fetchUnits()
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm(`${t('files.confirmDelete') || 'Are you sure you want to delete this file?'} (${filename})`)) return
    try {
      await api.deleteFile(filename)
      toast.success(t('common.success') || 'Success')
      onDeleted()
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

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm text-accent font-mono font-semibold">{filename}</span>
            <ViewToggle mode={mode} onChange={handleModeChange} />
            {validation && (
              <span
                className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold',
                  validation.valid ? 'text-accent' : 'text-danger'
                )}
              >
                {validation.valid ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                {validation.valid ? t('files.valid') : t('files.invalid')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
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
              onClick={handleDelete}
            />
            <span className="w-[1px] h-5 bg-border mx-1" />
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-text-primary transition-colors rounded hover:bg-surface-raised"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Validation warnings */}
        {validation?.warnings && validation.warnings.length > 0 && (
          <div className="px-4 py-2.5 bg-yellow-500/5 border-b border-yellow-500/20 text-xs text-yellow-400 font-semibold shrink-0">
            {validation.warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        )}

        {/* Systemd service status bar */}
        <div className="px-4 py-2.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between text-sm gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-text-muted">{t('files.systemdService') || 'Systemd Service'}:</span>
              <span className="font-mono text-text-primary font-semibold">{unitName || 'unknown'}</span>
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
                    <span className="text-text-secondary font-semibold font-mono">{currentUnit.subState}</span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-yellow-500 font-semibold flex items-center gap-1">
                <AlertTriangle size={14} />
                {t('files.notDeployed') || 'Not deployed to systemd yet'}
              </span>
            )}
          </div>

          {currentUnit ? (
            <div className="flex items-center gap-1 self-end sm:self-auto">
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
              className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 rounded text-xs font-bold transition-all duration-200 self-end sm:self-auto"
            >
              {t('files.deployAndStart') || 'Deploy & Start Service'}
            </button>
          )}
        </div>

        {/* Editor content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {mode === 'wizard' && wizardData ? (
            <div className="h-full overflow-auto p-4">
              <ConfigWizard value={wizardData} onChange={handleWizardChange} />
            </div>
          ) : (
            <QuadletEditor
              value={content}
              onChange={setContent}
              className="h-full"
            />
          )}
        </div>
      </div>
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
        'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-all duration-200 disabled:opacity-50 font-semibold',
        color
      )}
    >
      <Icon size={14} />
      <span className="hidden lg:inline">{label}</span>
    </button>
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
      className={cn('p-2 rounded transition-all duration-200 disabled:opacity-50', color)}
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
