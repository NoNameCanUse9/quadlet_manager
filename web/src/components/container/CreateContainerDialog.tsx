import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import { ConfigWizard, wizardToQuadlet, defaultWizardData, type WizardData } from '@/components/wizard/ConfigWizard'
import { api } from '@/api/client'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const initialData: WizardData = defaultWizardData

export function CreateContainerDialog({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [data, setData] = useState<WizardData>(initialData)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const canSubmit = name.trim() && data.container.image.trim()

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const filename = `${name.trim()}.container`
      const dataWithName = {
        ...data,
        unit: { ...data.unit, description: data.unit.description || name.trim() },
      }
      const content = wizardToQuadlet(dataWithName)
      await api.applyFile(filename, content)
      toast.success(t('containers.createSuccess'))
      setName('')
      setData(initialData)
      onCreated()
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg max-w-xl w-full mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-text-primary">{t('containers.createTitle')}</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Container Name */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
              {t('containers.containerName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-app"
              className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Config Wizard */}
          <ConfigWizard value={data} onChange={setData} />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            {t('containers.createAndStart')}
          </button>
        </div>
      </div>
    </div>
  )
}
