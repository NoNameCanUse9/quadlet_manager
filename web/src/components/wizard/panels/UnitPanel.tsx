import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import type { UnitData } from '../types'
import { api } from '@/api/client'

interface Props {
  data: UnitData
  onChange: (data: Partial<UnitData>) => void
}

export function UnitPanel({ data, onChange }: Props) {
  const { t } = useTranslation()
  const { data: units } = useQuery({
    queryKey: ['units-autocomplete'],
    queryFn: api.listUnits,
    staleTime: 30_000,
  })

  const serviceNames = (units as any[])?.map((u: any) => u.name).filter((n: string) => n.endsWith('.service')) || []

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {t('wizard.description')}
        </label>
        <input
          type="text"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="My container service"
          className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {t('wizard.after')}
        </label>
        <ServiceChipInput
          items={data.after}
          suggestions={serviceNames}
          onAdd={(v) => onChange({ after: [...data.after, v] })}
          onRemove={(i) => onChange({ after: data.after.filter((_, idx) => idx !== i) })}
          placeholder="network-online.target"
        />
      </div>

      <div>
        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {t('wizard.requires')}
        </label>
        <ServiceChipInput
          items={data.requires}
          suggestions={serviceNames}
          onAdd={(v) => onChange({ requires: [...data.requires, v] })}
          onRemove={(i) => onChange({ requires: data.requires.filter((_, idx) => idx !== i) })}
          placeholder="rclone-openlist.service"
        />
      </div>

      <div>
        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {t('wizard.wants')}
        </label>
        <ServiceChipInput
          items={data.wants}
          suggestions={serviceNames}
          onAdd={(v) => onChange({ wants: [...data.wants, v] })}
          onRemove={(i) => onChange({ wants: data.wants.filter((_, idx) => idx !== i) })}
          placeholder="monitoring.service"
        />
      </div>
    </div>
  )
}

function ServiceChipInput({
  items,
  suggestions,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[]
  suggestions: string[]
  onAdd: (v: string) => void
  onRemove: (i: number) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(draft.toLowerCase()) && !items.includes(s)
  )

  const handleAdd = (value: string) => {
    const v = value.trim()
    if (v) {
      onAdd(v)
      setDraft('')
      setShowSuggestions(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 bg-accent-dim text-accent rounded px-2 py-0.5 text-xs group"
          >
            {item}
            <button
              onClick={() => onRemove(i)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-accent"
            >
              {'×'}
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd(draft)
          }}
          placeholder={placeholder}
          className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded shadow-lg max-h-32 overflow-auto">
            {filtered.slice(0, 8).map((s) => (
              <button
                key={s}
                onMouseDown={() => handleAdd(s)}
                className="w-full text-left px-2 py-1 text-xs text-text-primary hover:bg-surface-raised transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
