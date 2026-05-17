import { useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WizardData {
  image: string
  exec: string
  ports: string[]
  volumes: string[]
  env: string[]
  user: string
  group: string
  hostName: string
  network: string
  restartPolicy: string
}

const defaultData: WizardData = {
  image: '',
  exec: '',
  ports: [],
  volumes: [],
  env: [],
  user: '',
  group: '',
  hostName: '',
  network: '',
  restartPolicy: 'always',
}

interface ConfigWizardProps {
  value: WizardData
  onChange: (data: WizardData) => void
}

export function ConfigWizard({ value, onChange }: ConfigWizardProps) {
  const data = { ...defaultData, ...value }

  const update = useCallback(
    (patch: Partial<WizardData>) => {
      onChange({ ...data, ...patch })
    },
    [data, onChange]
  )

  return (
    <div className="space-y-4 text-xs">
      {/* Image */}
      <Section title="Image">
        <Input
          value={data.image}
          onChange={(v) => update({ image: v })}
          placeholder="docker.io/library/nginx:latest"
        />
      </Section>

      {/* Exec */}
      <Section title="Command">
        <Input
          value={data.exec}
          onChange={(v) => update({ exec: v })}
          placeholder="/usr/sbin/nginx -g 'daemon off;'"
        />
      </Section>

      {/* Ports */}
      <Section title="PublishPort">
        <MultiInput
          items={data.ports}
          onAdd={(v) => update({ ports: [...data.ports, v] })}
          onRemove={(i) => update({ ports: data.ports.filter((_, idx) => idx !== i) })}
          placeholder="8080:80"
        />
      </Section>

      {/* Volumes */}
      <Section title="Volume">
        <MultiInput
          items={data.volumes}
          onAdd={(v) => update({ volumes: [...data.volumes, v] })}
          onRemove={(i) => update({ volumes: data.volumes.filter((_, idx) => idx !== i) })}
          placeholder="/host/path:/container/path"
        />
      </Section>

      {/* Environment */}
      <Section title="Environment">
        <MultiInput
          items={data.env}
          onAdd={(v) => update({ env: [...data.env, v] })}
          onRemove={(i) => update({ env: data.env.filter((_, idx) => idx !== i) })}
          placeholder="KEY=value"
        />
      </Section>

      {/* Network / HostName */}
      <Section title="Network">
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={data.network}
            onChange={(v) => update({ network: v })}
            placeholder="Network name"
          />
          <Input
            value={data.hostName}
            onChange={(v) => update({ hostName: v })}
            placeholder="Hostname"
          />
        </div>
      </Section>

      {/* User / Group */}
      <Section title="User / Group">
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={data.user}
            onChange={(v) => update({ user: v })}
            placeholder="UID (e.g. 1000)"
          />
          <Input
            value={data.group}
            onChange={(v) => update({ group: v })}
            placeholder="GID (e.g. 1000)"
          />
        </div>
      </Section>

      {/* Restart Policy */}
      <Section title="Restart Policy">
        <select
          value={data.restartPolicy}
          onChange={(e) => update({ restartPolicy: e.target.value })}
          className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="always">always</option>
          <option value="no">no</option>
          <option value="on-failure">on-failure</option>
          <option value="unless-stopped">unless-stopped</option>
        </select>
      </Section>
    </div>
  )
}

/** Convert wizard data to Quadlet INI content */
export function wizardToQuadlet(data: WizardData, unitName = 'my-container'): string {
  const lines: string[] = []

  lines.push('[Unit]')
  lines.push(`Description=${unitName} container`)
  lines.push('')

  lines.push('[Container]')
  if (data.image) lines.push(`Image=${data.image}`)
  if (data.exec) lines.push(`Exec=${data.exec}`)
  data.ports.forEach((p) => lines.push(`PublishPort=${p}`))
  data.volumes.forEach((v) => lines.push(`Volume=${v}`))
  data.env.forEach((e) => lines.push(`Environment=${e}`))
  if (data.user) lines.push(`User=${data.user}`)
  if (data.group) lines.push(`Group=${data.group}`)
  if (data.hostName) lines.push(`HostName=${data.hostName}`)
  if (data.network) lines.push(`Network=${data.network}`)
  lines.push('')

  lines.push('[Service]')
  lines.push(`Restart=${data.restartPolicy}`)
  lines.push('TimeoutStartSec=300')
  lines.push('')

  lines.push('[Install]')
  lines.push('WantedBy=multi-user.target default.target')

  return lines.join('\n')
}

/** Parse Quadlet INI content back to wizard data */
export function quadletToWizard(content: string): WizardData {
  const data: WizardData = { ...defaultData }
  let section = ''

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      section = trimmed.slice(1, -1)
      continue
    }

    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()

    if (section === 'Container') {
      switch (key) {
        case 'Image': data.image = val; break
        case 'Exec': data.exec = val; break
        case 'PublishPort': data.ports.push(val); break
        case 'Volume': data.volumes.push(val); break
        case 'Environment': data.env.push(val); break
        case 'User': data.user = val; break
        case 'Group': data.group = val; break
        case 'HostName': data.hostName = val; break
        case 'Network': data.network = val; break
      }
    }
    if (section === 'Service' && key === 'Restart') {
      data.restartPolicy = val
    }
  }

  return data
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
        {title}
      </label>
      {children}
    </div>
  )
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
    />
  )
}

function MultiInput({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[]
  onAdd: (v: string) => void
  onRemove: (i: number) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  const handleAdd = () => {
    const v = draft.trim()
    if (v) {
      onAdd(v)
      setDraft('')
    }
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="flex-1 bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary truncate">
            {item}
          </span>
          <button
            onClick={() => onRemove(i)}
            className="p-1 text-text-muted hover:text-danger transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          className="flex-1 bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={handleAdd}
          className={cn(
            'p-1.5 rounded bg-accent-dim text-accent hover:bg-accent hover:text-background transition-all duration-200'
          )}
        >
          <Plus size={10} />
        </button>
      </div>
    </div>
  )
}
