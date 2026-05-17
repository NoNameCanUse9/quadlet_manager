import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, type ImageInfo } from '@/api/client'
import { RefreshCw } from 'lucide-react'

export function ImagesPage() {
  const { t } = useTranslation()
  const [images, setImages] = useState<ImageInfo[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      setImages(await api.listImages())
    } catch {
      // ignore
    }
    setLoading(false)
  }

  useEffect(() => {
    fetch()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
          {t('sidebar.images')}
        </h2>
        <button
          onClick={fetch}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
        >
          <RefreshCw size={12} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="border border-border rounded bg-surface overflow-hidden">
        {loading ? (
          <div className="p-4 text-xs text-text-muted">{t('common.loading')}</div>
        ) : images.length === 0 ? (
          <div className="p-4 text-xs text-text-muted">No images found</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted text-left border-b border-border bg-surface-raised">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Tags</th>
                <th className="px-3 py-2 font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {images.map((img) => (
                <tr
                  key={img.id}
                  className="border-b border-border hover:bg-surface-raised transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-text-muted">
                    {img.id.slice(0, 12)}
                  </td>
                  <td className="px-3 py-2 text-text-primary">
                    {img.tags.join(', ') || '-'}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {formatBytes(img.size)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
