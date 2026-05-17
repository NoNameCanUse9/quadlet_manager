import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/useApp'
import { api } from '@/api/client'
import { QuadletEditor } from '@/components/editor/QuadletEditor'
import { ViewToggle } from '@/components/editor/ViewToggle'
import {
  ConfigWizard,
  wizardToQuadlet,
  quadletToWizard,
  type WizardData,
} from '@/components/wizard/ConfigWizard'
import {
  Save,
  Play,
  Trash2,
  RefreshCw,
  Plus,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function FilesPage() {
  const { t } = useTranslation()
  const { files, fetchFiles, selectedFile, selectFile } = useApp()
  const [content, setContent] = useState('')
  const [wizardData, setWizardData] = useState<WizardData | null>(null)
  const [mode, setMode] = useState<'wizard' | 'editor'>('editor')
  const [saving, setSaving] = useState(false)
  const [validation, setValidation] = useState<{
    valid: boolean
    warnings?: string[]
  } | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newFilename, setNewFilename] = useState('')

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

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
    } catch (e) {
      alert((e as Error).message)
    }
    setSaving(false)
  }

  const handleApply = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      await api.applyFile(selectedFile, content)
    } catch (e) {
      alert((e as Error).message)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!selectedFile) return
    if (!confirm(`${t('files.delete')} ${selectedFile}?`)) return
    try {
      await api.deleteFile(selectedFile)
      selectFile(null)
      fetchFiles()
    } catch (e) {
      alert((e as Error).message)
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
    if (!newFilename.trim()) return
    try {
      await api.createFile(newFilename.trim(), '')
      setShowCreate(false)
      setNewFilename('')
      await fetchFiles()
      selectFile(newFilename.trim())
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="flex gap-4 h-full">
      {/* File List */}
      <div className="w-48 flex-shrink-0 border border-border rounded bg-surface flex flex-col">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-[10px] tracking-widest text-text-muted uppercase">
            {t('files.title')}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="p-0.5 text-text-muted hover:text-accent transition-colors"
              title={t('files.create')}
            >
              <Plus size={12} />
            </button>
            <button
              onClick={fetchFiles}
              className="p-0.5 text-text-muted hover:text-text-primary transition-colors"
            >
              <RefreshCw size={10} />
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="px-2 py-2 border-b border-border">
            <input
              type="text"
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="nginx.container"
              className="w-full bg-surface-raised border border-border rounded px-2 py-1 text-[10px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
        )}

        <div className="flex-1 overflow-auto py-1">
          {files.map((f) => (
            <button
              key={f.name}
              onClick={() => selectFile(f.name)}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs transition-all duration-200',
                selectedFile === f.name
                  ? 'border-l-2 border-accent text-accent bg-accent-dim'
                  : 'border-l-2 border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-raised'
              )}
            >
              <span className="truncate block">{f.name}</span>
              <span className="text-[10px] text-text-muted">{f.type}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-accent font-medium">{selectedFile}</span>
                <ViewToggle mode={mode} onChange={handleModeChange} />
              </div>
              <div className="flex items-center gap-1">
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
                  onClick={handleDelete}
                />
              </div>
            </div>

            {/* Validation warnings */}
            {validation?.warnings && validation.warnings.length > 0 && (
              <div className="mb-2 px-3 py-2 bg-yellow-500/5 border border-yellow-500/20 rounded text-[10px] text-yellow-400">
                {validation.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}

            {/* Content */}
            {mode === 'wizard' && wizardData ? (
              <div className="flex-1 overflow-auto border border-border rounded bg-surface p-3">
                <ConfigWizard value={wizardData} onChange={handleWizardChange} />
              </div>
            ) : (
              <QuadletEditor
                value={content}
                onChange={setContent}
                className="flex-1"
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
            {t('files.title')} — {t('common.loading')}
          </div>
        )}
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
        'flex items-center gap-1.5 px-2 py-1 text-[10px] rounded transition-all duration-200 disabled:opacity-50',
        color
      )}
    >
      <Icon size={12} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  )
}
