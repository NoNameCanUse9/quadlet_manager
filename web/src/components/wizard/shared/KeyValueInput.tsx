import { useState } from 'react'
import { X, Plus } from 'lucide-react'

interface KeyValueInputProps {
  items: Array<{ key: string; value: string }>
  onAdd: (key: string, value: string) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, key: string, value: string) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}

export function KeyValueInput({
  items,
  onAdd,
  onRemove,
  onUpdate,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: KeyValueInputProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const handleAdd = () => {
    if (newKey.trim()) {
      onAdd(newKey.trim(), newValue)
      setNewKey('')
      setNewValue('')
      setShowAdd(false)
    }
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="text"
            value={item.key}
            onChange={(e) => onUpdate(i, e.target.value, item.value)}
            className="flex-1 bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
            placeholder={keyPlaceholder}
          />
          <span className="text-text-muted text-xs">=</span>
          <input
            type="text"
            value={item.value}
            onChange={(e) => onUpdate(i, item.key, e.target.value)}
            className="flex-1 bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
            placeholder={valuePlaceholder}
          />
          <button
            onClick={() => onRemove(i)}
            className="p-1 text-text-muted hover:text-danger transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      {showAdd ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="flex-1 bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
            placeholder={keyPlaceholder}
            autoFocus
          />
          <span className="text-text-muted text-xs">=</span>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
            placeholder={valuePlaceholder}
          />
          <button
            onClick={handleAdd}
            className="p-1 text-accent hover:text-accent/80 transition-colors"
          >
            <Plus size={10} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-text-muted hover:text-accent text-xs transition-colors"
        >
          <Plus size={10} />
          Add
        </button>
      )}
    </div>
  )
}
