import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChipInputProps {
  items: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, value: string) => void
  formatItem?: (item: string) => string
  placeholder?: string
  addPlaceholder?: string
}

export function ChipInput({
  items,
  onAdd,
  onRemove,
  onUpdate,
  formatItem,
  placeholder = 'Add...',
  addPlaceholder = 'Add...',
}: ChipInputProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addDraft, setAddDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editingIndex])

  useEffect(() => {
    if (showAdd && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [showAdd])

  const handleChipClick = (index: number) => {
    setEditingIndex(index)
    setDraft(items[index])
  }

  const handleBlur = () => {
    if (editingIndex !== null) {
      if (draft.trim()) {
        onUpdate(editingIndex, draft.trim())
      } else {
        onRemove(editingIndex)
      }
      setEditingIndex(null)
      setDraft('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    } else if (e.key === 'Escape') {
      setEditingIndex(null)
      setDraft('')
    }
  }

  const handleAddBlur = () => {
    if (addDraft.trim()) {
      onAdd(addDraft.trim())
    }
    setShowAdd(false)
    setAddDraft('')
  }

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddBlur()
    } else if (e.key === 'Escape') {
      setShowAdd(false)
      setAddDraft('')
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <div key={i}>
            {editingIndex === i ? (
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="bg-surface-raised border border-accent rounded px-2 py-0.5 text-xs text-text-primary focus:outline-none w-32"
              />
            ) : (
              <span
                onClick={() => handleChipClick(i)}
                className={cn(
                  'inline-flex items-center gap-1 bg-accent-dim text-accent rounded px-2 py-0.5 text-xs cursor-pointer',
                  'hover:bg-accent hover:text-background transition-colors group'
                )}
              >
                {formatItem ? formatItem(item) : item}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(i)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
        ))}
        {showAdd ? (
          <input
            ref={addInputRef}
            type="text"
            value={addDraft}
            onChange={(e) => setAddDraft(e.target.value)}
            onBlur={handleAddBlur}
            onKeyDown={handleAddKeyDown}
            placeholder={addPlaceholder}
            className="bg-surface-raised border border-border rounded px-2 py-0.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-32"
          />
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
