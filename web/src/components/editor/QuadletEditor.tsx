import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'

// Simple INI/Quadlet language mode
const quadletLanguage = StreamLanguage.define({
  token(stream) {
    // Comments
    if (stream.match(/^#.*/)) return 'lineComment'
    // Section headers
    if (stream.match(/^\[[^\]]+\]/)) return 'keyword'
    // Key = Value
    if (stream.match(/^[A-Z][A-Za-z]*(?==)/)) return 'propertyName'
    // Equals sign
    if (stream.match(/^=/)) return 'operator'
    // Value (rest of line)
    if (stream.match(/.+/)) return 'string'
    stream.next()
    return null
  },
})

interface QuadletEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function QuadletEditor({ value, onChange, className }: QuadletEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString())
      }
    })

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        quadletLanguage,
        oneDark,
        updateListener,
        EditorView.theme({
          '&': {
            fontSize: '12px',
            fontFamily: '"JetBrains Mono", monospace',
          },
          '.cm-content': {
            padding: '8px 0',
          },
          '.cm-gutters': {
            backgroundColor: '#0A0A0A',
            borderRight: '1px solid #1A1A1A',
            color: '#52525B',
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            color: '#10B981',
          },
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })
    viewRef.current = view

    return () => {
      view.destroy()
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      className={`border border-border rounded overflow-hidden ${className || ''}`}
    />
  )
}
