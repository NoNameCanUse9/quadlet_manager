import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Copy, Check, Loader2 } from 'lucide-react'
import { api } from '@/api/client'
import { toast } from 'sonner'
import type { QuadletConversion } from '@/api/client'

interface Props {
  open: boolean
  onClose: () => void
  conversions: QuadletConversion[]
  projectName: string
  onApplied?: () => void
}

export function ConvertPreviewDialog({ open, onClose, conversions, projectName, onApplied }: Props) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const [applying, setApplying] = useState(false)

  if (!open || conversions.length === 0) return null

  const active = conversions[activeTab]

  const handleCopy = () => {
    navigator.clipboard.writeText(active.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApplyAll = async () => {
    setApplying(true)
    try {
      for (const conv of conversions) {
        await api.applyFile(conv.filename, conv.content)
      }
      toast.success(t('compose.converted'))
      onApplied?.()
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-4 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text-primary">
            {t('compose.convertTitle')} — {projectName}
          </h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-3 overflow-x-auto">
          {conversions.map((c, i) => (
            <button
              key={c.filename}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 text-xs whitespace-nowrap border-b-2 transition-colors ${
                i === activeTab
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {c.filename}
            </button>
          ))}
        </div>

        {/* Warnings */}
        {active.warnings && active.warnings.length > 0 && (
          <div className="mb-3 space-y-1">
            {active.warnings.map((w, i) => (
              <div key={i} className="text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/20 rounded px-2 py-1">
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="relative flex-1 min-h-0">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1 text-text-secondary hover:text-text-primary z-10"
            title="Copy"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
          <pre className="bg-surface-raised border border-border rounded p-3 text-xs text-text-primary font-mono overflow-auto h-full max-h-96">
            {active.content}
          </pre>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleApplyAll}
            disabled={applying}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {applying && <Loader2 size={12} className="animate-spin" />}
            {t('compose.saveAndApply')}
          </button>
        </div>
      </div>
    </div>
  )
}
