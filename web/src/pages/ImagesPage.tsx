import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Download, Trash2 } from 'lucide-react'
import { useImages, usePullImage, useRemoveImage } from '@/hooks/useImages'
import { toast } from 'sonner'

export function ImagesPage() {
  const { t } = useTranslation()
  const [pullDialog, setPullDialog] = useState(false)
  const [pullName, setPullName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: imagesData, isLoading, error, refetch } = useImages()
  const images = imagesData ?? []
  const pullMut = usePullImage()
  const removeMut = useRemoveImage()

  const handlePull = async () => {
    if (!pullName.trim()) return
    try {
      const { task_id } = await pullMut.mutateAsync(pullName.trim())
      toast.success(`Pull started (task: ${task_id.slice(0, 8)})`)
      setPullDialog(false)
      setPullName('')
    } catch (e: any) {
      toast.error(e.message || 'Pull failed')
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await removeMut.mutateAsync({ id, force: true })
      toast.success('Image removed')
      setDeleteTarget(null)
    } catch (e: any) {
      toast.error(e.message || 'Remove failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
          {t('sidebar.images')}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setPullDialog(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20">
            <Download size={12} /> {t('images.pull')}
          </button>
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
              <th className="px-3 py-2 text-left font-medium">{t('common.id')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('images.tags')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('images.size')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {images.map(img => (
              <tr key={img.id} className="hover:bg-surface-raised/50">
                <td className="px-3 py-2 font-mono text-text-muted">{img.id.slice(0, 12)}</td>
                <td className="px-3 py-2 text-text-primary">{img.tags.join(', ') || '-'}</td>
                <td className="px-3 py-2 text-right text-text-secondary">{formatBytes(img.size)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setDeleteTarget(img.id)}
                    className="p-1 text-text-secondary hover:text-red-400" title={t('common.remove') || 'Remove'}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pullDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-4 max-w-sm w-full mx-4">
            <p className="text-sm text-text-primary mb-3">{t('images.pullTitle')}</p>
            <input
              type="text"
              placeholder={t('images.pullPlaceholder') || 'image:tag (e.g. nginx:latest)'}
              value={pullName}
              onChange={e => setPullName(e.target.value)}
              className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setPullDialog(false); setPullName('') }}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised">
                {t('common.cancel')}
              </button>
              <button onClick={handlePull} disabled={pullMut.isPending}
                className="px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 disabled:opacity-50">
                {pullMut.isPending ? t('common.loading') : t('images.pull')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-4 max-w-sm w-full mx-4">
            <p className="text-sm text-text-primary mb-4">{t('images.removeConfirm')}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised">
                {t('common.cancel')}
              </button>
              <button onClick={() => handleRemove(deleteTarget)}
                className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20">
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
