import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Code } from 'lucide-react'

interface CodePreviewProps {
  content: string
}

function highlightINI(content: string): React.ReactNode[] {
  return content.split('\n').map((line, i) => {
    if (line.startsWith('[') && line.endsWith(']')) {
      return (
        <div key={i} className="text-accent font-bold">
          {line}
        </div>
      )
    }
    if (line.startsWith('#')) {
      return (
        <div key={i} className="text-text-muted italic">
          {line}
        </div>
      )
    }
    const eq = line.indexOf('=')
    if (eq > 0) {
      const key = line.slice(0, eq)
      const val = line.slice(eq + 1)
      const isAutoUpdateLabel = key === 'Label' && val.includes('io.containers.autoupdate')
      return (
        <div key={i} className={isAutoUpdateLabel ? 'text-yellow-400' : ''}>
          <span className="text-emerald-400">{key}</span>
          <span className="text-text-muted">=</span>
          <span className="text-text-primary">{val}</span>
        </div>
      )
    }
    return <div key={i}>{line}</div>
  })
}

export function CodePreview({ content }: CodePreviewProps) {
  const { t } = useTranslation()
  const highlighted = useMemo(() => highlightINI(content), [content])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border text-text-muted">
        <Code size={12} />
        <span className="text-[10px] uppercase tracking-wider">{t('wizard.codePreview')}</span>
      </div>
      <pre className="flex-1 overflow-auto p-3 text-xs font-mono leading-relaxed bg-surface-raised">
        {highlighted}
      </pre>
    </div>
  )
}
