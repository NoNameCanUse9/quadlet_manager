import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, type VolumeInfo } from '@/api/client'
import { RefreshCw } from 'lucide-react'

export function VolumesPage() {
  const { t } = useTranslation()
  const [volumes, setVolumes] = useState<VolumeInfo[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      setVolumes(await api.listVolumes())
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
          {t('volumes.title')}
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
        ) : volumes.length === 0 ? (
          <div className="p-4 text-xs text-text-muted">{t('volumes.noData')}</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted text-left border-b border-border bg-surface-raised">
                <th className="px-3 py-2 font-medium">{t('volumes.name')}</th>
                <th className="px-3 py-2 font-medium">{t('volumes.mountPoint')}</th>
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <tr
                  key={v.name}
                  className="border-b border-border hover:bg-surface-raised transition-colors"
                >
                  <td className="px-3 py-2 text-text-primary">{v.name}</td>
                  <td className="px-3 py-2 text-text-muted font-mono text-[10px]">
                    {v.mountPoint}
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
