import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Plus, Trash2 } from 'lucide-react'
import { useNetworks, useCreateNetwork, useRemoveNetwork } from '@/hooks/useNetworks'
import { toast } from 'sonner'

export function NetworksPage() {
  const { t } = useTranslation()
  const [createDialog, setCreateDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDriver, setNewDriver] = useState('')
  const [newSubnet, setNewSubnet] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: networksData, isLoading, error, refetch } = useNetworks()
  const networks = networksData ?? []
  const createMut = useCreateNetwork()
  const removeMut = useRemoveNetwork()

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createMut.mutateAsync({
        name: newName.trim(),
        driver: newDriver.trim() || undefined,
        subnet: newSubnet.trim() || undefined,
      })
      toast.success('Network created')
      setCreateDialog(false)
      setNewName('')
      setNewDriver('')
      setNewSubnet('')
    } catch (e: any) {
      toast.error(e.message || 'Create failed')
    }
  }

  const handleRemove = async (name: string) => {
    try {
      await removeMut.mutateAsync(name)
      toast.success('Network removed')
      setDeleteTarget(null)
    } catch (e: any) {
      toast.error(e.message || 'Remove failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
          {t('sidebar.networks')}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreateDialog(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20">
            <Plus size={12} /> {t('common.create')}
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
              <th className="px-3 py-2 text-left font-medium">{t('common.name')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('common.id')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {networks.map(n => (
              <tr key={n.id} className="hover:bg-surface-raised/50">
                <td className="px-3 py-2 text-text-primary">{n.name}</td>
                <td className="px-3 py-2 text-text-muted font-mono text-[10px]">{n.id.slice(0, 12)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setDeleteTarget(n.name)}
                    className="p-1 text-text-secondary hover:text-red-400" title={t('common.remove') || 'Remove'}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-4 max-w-sm w-full mx-4">
            <p className="text-sm text-text-primary mb-3">{t('networks.createTitle')}</p>
            <div className="space-y-2 mb-4">
              <input
                type="text"
                placeholder={t('networks.namePlaceholder') || 'Network name *'}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary"
                autoFocus
              />
              <input
                type="text"
                placeholder={t('networks.driverPlaceholder') || 'Driver (default: bridge)'}
                value={newDriver}
                onChange={e => setNewDriver(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary"
              />
              <input
                type="text"
                placeholder={t('networks.subnetPlaceholder') || 'Subnet (e.g. 10.89.0.0/24)'}
                value={newSubnet}
                onChange={e => setNewSubnet(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded px-3 py-2 text-xs text-text-primary"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setCreateDialog(false); setNewName(''); setNewDriver(''); setNewSubnet('') }}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-raised">
                {t('common.cancel')}
              </button>
              <button onClick={handleCreate} disabled={createMut.isPending}
                className="px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 disabled:opacity-50">
                {createMut.isPending ? t('common.loading') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-4 max-w-sm w-full mx-4">
            <p className="text-sm text-text-primary mb-4">{t('networks.removeConfirm', { name: deleteTarget })}</p>
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
