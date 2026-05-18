import { useTranslation } from 'react-i18next'
import { Play, Square, Trash2, RefreshCw } from 'lucide-react'
import type { ComposeProject } from '@/api/client'
import { useComposeUp, useComposeDown, useRemoveComposeProject } from '@/hooks/useCompose'
import { toast } from 'sonner'

interface Props {
  project: ComposeProject
  onConvert: (name: string) => void
}

export function ComposeProjectCard({ project, onConvert }: Props) {
  const { t } = useTranslation()
  const upMut = useComposeUp()
  const downMut = useComposeDown()
  const removeMut = useRemoveComposeProject()

  const isRunning = project.status === 'running'

  const handleAction = async (action: () => Promise<any>, label: string) => {
    try {
      await action()
      toast.success(label)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="border border-border rounded p-3 hover:bg-surface-raised/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{project.name}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
            isRunning ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'
          }`}>
            {project.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isRunning ? (
            <button
              onClick={() => handleAction(() => downMut.mutateAsync(project.name), t('compose.stopped'))}
              className="p-1 text-text-secondary hover:text-red-400"
              title={t('compose.down')}
            >
              <Square size={12} />
            </button>
          ) : (
            <button
              onClick={() => handleAction(() => upMut.mutateAsync(project.name), t('compose.started'))}
              className="p-1 text-text-secondary hover:text-emerald-400"
              title={t('compose.up')}
            >
              <Play size={12} />
            </button>
          )}
          <button
            onClick={() => onConvert(project.name)}
            className="p-1 text-text-secondary hover:text-blue-400 text-[10px] font-medium"
            title={t('compose.convert')}
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => {
              if (confirm(t('compose.removeConfirm', { name: project.name }))) {
                handleAction(() => removeMut.mutateAsync(project.name), t('compose.removed'))
              }
            }}
            className="p-1 text-text-secondary hover:text-red-400"
            title={t('common.remove')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {project.services && project.services.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {project.services.map(s => (
            <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-raised text-text-secondary">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
