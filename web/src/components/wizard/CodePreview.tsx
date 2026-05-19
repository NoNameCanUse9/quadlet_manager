import { useMemo, useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Code } from 'lucide-react'

interface CodePreviewProps {
  content: string
}

function highlightINI(content: string, changedLines: Set<number>): React.ReactNode[] {
  return content.split('\n').map((line, i) => {
    const isChanged = changedLines.has(i)
    const baseClass = isChanged ? 'animate-highlight' : ''

    if (line.startsWith('[') && line.endsWith(']')) {
      return (
        <div key={i} className={`text-accent font-bold ${baseClass}`}>
          {line}
        </div>
      )
    }
    if (line.startsWith('#')) {
      return (
        <div key={i} className={`text-text-muted italic ${baseClass}`}>
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
        <div key={i} className={`${isAutoUpdateLabel ? 'text-yellow-400' : ''} ${baseClass}`}>
          <span className="text-emerald-400">{key}</span>
          <span className="text-text-muted">=</span>
          <span className="text-text-primary">{val}</span>
        </div>
      )
    }
    return <div key={i} className={baseClass}>{line}</div>
  })
}

export function CodePreview({ content }: CodePreviewProps) {
  const { t } = useTranslation()
  const prevContentRef = useRef(content)
  const [changedLines, setChangedLines] = useState<Set<number>>(new Set())

  useEffect(() => {
    const prev = prevContentRef.current
    if (prev !== content) {
      const prevLines = prev.split('\n')
      const newLines = content.split('\n')
      const changed = new Set<number>()
      const maxLen = Math.max(prevLines.length, newLines.length)
      for (let i = 0; i < maxLen; i++) {
        if (prevLines[i] !== newLines[i]) {
          changed.add(i)
        }
      }
      if (changed.size > 0) {
        setChangedLines(changed)
        const timer = setTimeout(() => setChangedLines(new Set()), 600)
        prevContentRef.current = content
        return () => clearTimeout(timer)
      }
      prevContentRef.current = content
    }
  }, [content])

  const highlighted = useMemo(
    () => highlightINI(content, changedLines),
    [content, changedLines]
  )

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
