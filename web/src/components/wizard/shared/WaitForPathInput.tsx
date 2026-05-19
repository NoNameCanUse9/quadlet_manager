import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WaitForPath } from '../types'

interface Props {
  items: WaitForPath[]
  onAdd: (item: WaitForPath) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, item: WaitForPath) => void
  placeholder?: string
  addPlaceholder?: string
  strictLabel?: string
}

export function WaitForPathInput({
  items,
  onAdd,
  onRemove,
  onUpdate,
  placeholder = 'Add path...',
  addPlaceholder = '/data',
  strictLabel = 'Strict',
}: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [addDraft, setAddDraft] = useState('')
  const [addStrict, setAddStrict] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showAdd && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [showAdd])

  const handleAdd = () => {
    const path = addDraft.trim()
    if (path) {
      onAdd({ path, strict: addStrict })
      setAddDraft('')
      setAddStrict(false)
      setShowAdd(false)
    }
  }

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
    else if (e.key === 'Escape') {
      setShowAdd(false)
      setAddDraft('')
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs group',
              item.strict
                ? 'bg-warning/10 text-warning'
                : 'bg-accent-dim text-accent'
            )}
          >
            {item.path}
            {item.strict && (
              <span className="text-[9px] opacity-60">M</span>
            )}
            <button
              onClick={() => onRemove(i)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {showAdd ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={addInputRef}
              type="text"
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              onKeyDown={handleAddKeyDown}
              onBlur={() => {
                if (!addDraft.trim()) {
                  setShowAdd(false)
                }
              }}
              placeholder={addPlaceholder}
              className="bg-surface-raised border border-border rounded px-2 py-0.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-32"
            />
            <label className="flex items-center gap-1 text-[10px] text-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addStrict}
                onChange={(e) => setAddStrict(e.target.checked)}
                className="accent-warning w-3 h-3"
              />
              {strictLabel}
            </label>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-0.5 text-text-muted hover:text-accent text-xs transition-colors"
          >
            <Plus size={10} />
            {placeholder}
          </button>
        )}
      </div>
    </div>
  )
}
