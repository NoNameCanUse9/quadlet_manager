import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useImportComposeProject } from '@/hooks/useCompose'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
}

export function ImportComposeDialog({ open, onClose }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const importMut = useImportComposeProject()

  if (!open) return null

  const handleSubmit = async () => {
    if (!name.trim() || !content.trim()) return
    try {
      await importMut.mutateAsync({ name: name.trim(), content })
      toast.success(t('compose.imported'))
      setName('')
      setContent('')
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-4 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-text-primary">{t('compose.importTitle')}</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
        <div className="space-y-3">
          <input
            type="text"
            placeholder={t('compose.namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary"
          />
          <textarea
            placeholder={t('compose.contentPlaceholder')}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={12}
            className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary font-mono resize-y"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !content.trim() || importMut.isPending}
            className="px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {importMut.isPending ? '...' : t('compose.import')}
          </button>
        </div>
      </div>
    </div>
  )
}
