import { useTranslation } from 'react-i18next'
import { Code, Sliders } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewToggleProps {
  mode: 'wizard' | 'editor'
  onChange: (mode: 'wizard' | 'editor') => void
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center border border-border rounded overflow-hidden">
      <button
        onClick={() => onChange('wizard')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-[10px] transition-all duration-200',
          mode === 'wizard'
            ? 'bg-accent-dim text-accent'
            : 'text-text-muted hover:text-text-primary'
        )}
      >
        <Sliders size={10} />
        {t('files.wizard')}
      </button>
      <button
        onClick={() => onChange('editor')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-[10px] transition-all duration-200 border-l border-border',
          mode === 'editor'
            ? 'bg-accent-dim text-accent'
            : 'text-text-muted hover:text-text-primary'
        )}
      >
        <Code size={10} />
        {t('files.editor')}
      </button>
    </div>
  )
}
