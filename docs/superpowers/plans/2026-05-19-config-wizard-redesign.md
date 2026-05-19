# ConfigWizard Phase 1 重设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ConfigWizard 从扁平表单重构为 Tabs 分组 + 左右分栏布局，支持 Unit 依赖管理、AutoUpdate 联动、结构化端口/卷/环境变量、实时代码预览。

**Architecture:** WizardData 按 Quadlet INI section 分为 container/unit/service 三个子对象。UI 使用自建 Tabs/Switch/Accordion 组件（基于 Radix UI），左右分栏布局，右侧实时 INI 预览。

**Tech Stack:** React 19, TypeScript, Radix UI (tabs/switch/accordion), Tailwind CSS 4, TanStack Query

---

## File Structure

```
web/src/components/wizard/
├── types.ts              # 所有类型定义
├── defaults.ts           # defaultWizardData
├── convert.ts            # wizardToQuadlet, quadletToWizard
├── ConfigWizard.tsx       # 主容器：左右分栏 + Tabs
├── CodePreview.tsx        # 右侧实时代码预览
├── panels/
│   ├── GeneralPanel.tsx   # Tab 1: 常规配置
│   ├── UnitPanel.tsx      # Tab 2: Unit 依赖
│   └── ServicePanel.tsx   # Tab 3: 服务配置
└── shared/
    ├── ChipInput.tsx      # Chip 行内编辑
    └── KeyValueInput.tsx  # Key-Value 对输入
web/src/components/ui/
├── tabs.tsx              # shadcn-style Tabs
├── switch.tsx            # shadcn-style Switch
└── accordion.tsx         # shadcn-style Accordion
```

---

### Task 1: 类型定义 (types.ts)

**Files:**
- Create: `web/src/components/wizard/types.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
// web/src/components/wizard/types.ts

/** 端口映射 */
export interface PortMapping {
  hostPort: string
  containerPort: string
  protocol: 'tcp' | 'udp'
}

/** 卷挂载 */
export interface VolumeMount {
  hostPath: string
  containerPath: string
  mode: 'rw' | 'ro'
}

/** 环境变量 */
export interface EnvVar {
  key: string
  value: string
}

/** 健康检查配置（Phase 2 实现 UI） */
export interface HealthCheckConfig {
  enabled: boolean
  cmd: string
  interval: string
  retries: number
  startPeriod: string
  timeout: string
}

export interface ContainerData {
  image: string
  exec: string
  ports: PortMapping[]
  volumes: VolumeMount[]
  env: EnvVar[]
  labels: Record<string, string>
  user: string
  group: string
  hostName: string
  network: string
  autoUpdate: 'registry' | 'local' | ''
  healthCheck: HealthCheckConfig
}

export interface UnitData {
  description: string
  after: string[]
  requires: string[]
  wants: string[]
}

export interface ServiceData {
  restart: 'always' | 'on-failure' | 'no' | 'unless-stopped'
  timeoutStartSec: string
  waitForPaths: string[]
  execStartPre: string[]
  execStartPost: string[]
}

export interface WizardData {
  container: ContainerData
  unit: UnitData
  service: ServiceData
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

---

### Task 2: 默认值 (defaults.ts)

**Files:**
- Create: `web/src/components/wizard/defaults.ts`

- [ ] **Step 1: 创建 defaults.ts**

```typescript
// web/src/components/wizard/defaults.ts
import type { WizardData } from './types'

export const defaultWizardData: WizardData = {
  container: {
    image: '',
    exec: '',
    ports: [],
    volumes: [],
    env: [],
    labels: {},
    user: '',
    group: '',
    hostName: '',
    network: '',
    autoUpdate: '',
    healthCheck: {
      enabled: false,
      cmd: '',
      interval: '10s',
      retries: 3,
      startPeriod: '30s',
      timeout: '5s',
    },
  },
  unit: {
    description: '',
    after: [],
    requires: [],
    wants: [],
  },
  service: {
    restart: 'always',
    timeoutStartSec: '300',
    waitForPaths: [],
    execStartPre: [],
    execStartPost: [],
  },
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

---

### Task 3: 转换逻辑 (convert.ts)

**Files:**
- Create: `web/src/components/wizard/convert.ts`

- [ ] **Step 1: 创建 convert.ts — wizardToQuadlet**

```typescript
// web/src/components/wizard/convert.ts
import type { WizardData } from './types'

/** 从镜像名提取简短名称作为 Description fallback */
function imageName(image: string): string {
  const parts = image.split('/')
  const last = parts[parts.length - 1] || image
  return last.split(':')[0]
}

/** WizardData → Quadlet INI 字符串 */
export function wizardToQuadlet(data: WizardData): string {
  const lines: string[] = []

  // [Unit]
  lines.push('[Unit]')
  const desc = data.unit.description || `${imageName(data.container.image)} container`
  lines.push(`Description=${desc}`)
  if (data.unit.after.length > 0) {
    lines.push(`After=${data.unit.after.join(' ')}`)
  }
  if (data.unit.requires.length > 0) {
    lines.push(`Requires=${data.unit.requires.join(' ')}`)
  }
  if (data.unit.wants.length > 0) {
    lines.push(`Wants=${data.unit.wants.join(' ')}`)
  }
  lines.push('')

  // [Container]
  lines.push('[Container]')
  if (data.container.image) lines.push(`Image=${data.container.image}`)
  if (data.container.exec) lines.push(`Exec=${data.container.exec}`)
  for (const p of data.container.ports) {
    lines.push(`PublishPort=${p.hostPort}:${p.containerPort}/${p.protocol}`)
  }
  for (const v of data.container.volumes) {
    lines.push(`Volume=${v.hostPath}:${v.containerPath}:${v.mode}`)
  }
  for (const e of data.container.env) {
    lines.push(`Environment=${e.key}=${e.value}`)
  }
  for (const [k, v] of Object.entries(data.container.labels)) {
    lines.push(`Label=${k}=${v}`)
  }
  if (data.container.autoUpdate) {
    lines.push(`AutoUpdate=${data.container.autoUpdate}`)
    if (data.container.autoUpdate === 'registry') {
      lines.push('Label=io.containers.autoupdate=registry')
    }
  }
  if (data.container.user) lines.push(`User=${data.container.user}`)
  if (data.container.group) lines.push(`Group=${data.container.group}`)
  if (data.container.hostName) lines.push(`HostName=${data.container.hostName}`)
  if (data.container.network) lines.push(`Network=${data.container.network}`)
  lines.push('')

  // [Service]
  lines.push('[Service]')
  lines.push(`Restart=${data.service.restart}`)
  lines.push(`TimeoutStartSec=${data.service.timeoutStartSec}`)
  lines.push('')

  // [Install]
  lines.push('[Install]')
  lines.push('WantedBy=default.target')

  return lines.join('\n')
}
```

- [ ] **Step 2: 创建 convert.ts — quadletToWizard**

在同文件中添加：

```typescript
import type { WizardData, PortMapping, VolumeMount, EnvVar } from './types'
import { defaultWizardData } from './defaults'

/** Quadlet INI 字符串 → WizardData */
export function quadletToWizard(content: string): WizardData {
  const data: WizardData = structuredClone(defaultWizardData)
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

    if (section === 'Unit') {
      switch (key) {
        case 'Description': data.unit.description = val; break
        case 'After': data.unit.after = val.split(/\s+/).filter(Boolean); break
        case 'Requires': data.unit.requires = val.split(/\s+/).filter(Boolean); break
        case 'Wants': data.unit.wants = val.split(/\s+/).filter(Boolean); break
      }
    }

    if (section === 'Container') {
      switch (key) {
        case 'Image': data.container.image = val; break
        case 'Exec': data.container.exec = val; break
        case 'PublishPort': {
          const p = parsePort(val)
          if (p) data.container.ports.push(p)
          break
        }
        case 'Volume': {
          const v = parseVolume(val)
          if (v) data.container.volumes.push(v)
          break
        }
        case 'Environment': {
          const idx = val.indexOf('=')
          if (idx >= 0) {
            data.container.env.push({ key: val.slice(0, idx), value: val.slice(idx + 1) })
          }
          break
        }
        case 'Label': {
          const idx = val.indexOf('=')
          if (idx >= 0) {
            const k = val.slice(0, idx)
            const v = val.slice(idx + 1)
            if (k === 'io.containers.autoupdate' && v === 'registry') {
              data.container.autoUpdate = 'registry'
            } else {
              data.container.labels[k] = v
            }
          }
          break
        }
        case 'AutoUpdate': {
          if (val === 'registry' || val === 'local') {
            data.container.autoUpdate = val
          }
          break
        }
        case 'User': data.container.user = val; break
        case 'Group': data.container.group = val; break
        case 'HostName': data.container.hostName = val; break
        case 'Network': data.container.network = val; break
      }
    }

    if (section === 'Service') {
      switch (key) {
        case 'Restart': {
          if (val === 'always' || val === 'on-failure' || val === 'no' || val === 'unless-stopped') {
            data.service.restart = val
          }
          break
        }
        case 'TimeoutStartSec': data.service.timeoutStartSec = val; break
      }
    }
  }

  return data
}

function parsePort(val: string): PortMapping | null {
  // Format: hostPort:containerPort/protocol or hostPort:containerPort
  const parts = val.split('/')
  const protocol = parts[1] === 'udp' ? 'udp' : 'tcp'
  const ports = parts[0].split(':')
  if (ports.length >= 2) {
    return { hostPort: ports[0], containerPort: ports[1], protocol }
  }
  if (ports.length === 1) {
    return { hostPort: ports[0], containerPort: ports[0], protocol }
  }
  return null
}

function parseVolume(val: string): VolumeMount | null {
  // Format: hostPath:containerPath:mode or hostPath:containerPath
  const parts = val.split(':')
  if (parts.length >= 2) {
    const mode = parts[2] === 'ro' ? 'ro' : 'rw'
    return { hostPath: parts[0], containerPath: parts[1], mode }
  }
  return null
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add web/src/components/wizard/types.ts web/src/components/wizard/defaults.ts web/src/components/wizard/convert.ts
git commit -m "feat(wizard): add types, defaults, and convert logic for structured WizardData"
```

---

### Task 4: shadcn-style 基础 UI 组件

**Files:**
- Create: `web/src/components/ui/tabs.tsx`
- Create: `web/src/components/ui/switch.tsx`
- Create: `web/src/components/ui/accordion.tsx`

- [ ] **Step 1: 安装 @radix-ui/react-accordion**

Run: `cd web && npm install @radix-ui/react-accordion`
Expected: package.json 更新

- [ ] **Step 2: 创建 tabs.tsx**

```tsx
// web/src/components/ui/tabs.tsx
import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center justify-center rounded-lg bg-surface-raised p-1 text-text-muted',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-surface data-[state=active]:text-text-primary data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

- [ ] **Step 3: 创建 switch.tsx**

```tsx
// web/src/components/ui/switch.tsx
import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
      'border-2 border-transparent shadow-sm transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-accent data-[state=unchecked]:bg-surface-raised',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0',
        'transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
```

- [ ] **Step 4: 创建 accordion.tsx**

```tsx
// web/src/components/ui/accordion.tsx
import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b border-border', className)}
    {...props}
  />
))
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-between py-2 text-xs font-medium text-text-primary',
        'transition-all hover:text-accent [&[data-state=open]>svg]:rotate-180',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-3 w-3 shrink-0 text-text-muted transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden text-xs data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
      className
    )}
    {...props}
  >
    <div className="pb-3 pt-0">{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
```

- [ ] **Step 5: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add web/src/components/ui/tabs.tsx web/src/components/ui/switch.tsx web/src/components/ui/accordion.tsx web/package.json web/package-lock.json
git commit -m "feat(ui): add shadcn-style Tabs, Switch, Accordion components"
```

---

### Task 5: 共享组件 — ChipInput + KeyValueInput

**Files:**
- Create: `web/src/components/wizard/shared/ChipInput.tsx`
- Create: `web/src/components/wizard/shared/KeyValueInput.tsx`

- [ ] **Step 1: 创建 ChipInput.tsx**

Chip 行内编辑组件：默认显示为 Chip，点击展开为输入框，失焦保存。

```tsx
// web/src/components/wizard/shared/ChipInput.tsx
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
```

- [ ] **Step 2: 创建 KeyValueInput.tsx**

Key-Value 对输入组件，用于 labels 和 env。

```tsx
// web/src/components/wizard/shared/KeyValueInput.tsx
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
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add web/src/components/wizard/shared/
git commit -m "feat(wizard): add ChipInput and KeyValueInput shared components"
```

---

### Task 6: CodePreview 组件

**Files:**
- Create: `web/src/components/wizard/CodePreview.tsx`

- [ ] **Step 1: 创建 CodePreview.tsx**

```tsx
// web/src/components/wizard/CodePreview.tsx
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Code } from 'lucide-react'

interface CodePreviewProps {
  content: string
}

/** 简单的 INI 语法高亮 */
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
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add web/src/components/wizard/CodePreview.tsx
git commit -m "feat(wizard): add CodePreview with INI syntax highlighting"
```

---

### Task 7: GeneralPanel (Tab 1)

**Files:**
- Create: `web/src/components/wizard/panels/GeneralPanel.tsx`

- [ ] **Step 1: 创建 GeneralPanel.tsx**

```tsx
// web/src/components/wizard/panels/GeneralPanel.tsx
import { useTranslation } from 'react-i18next'
import type { ContainerData } from '../types'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { ChipInput } from '../shared/ChipInput'
import { KeyValueInput } from '../shared/KeyValueInput'

interface Props {
  data: ContainerData
  onChange: (data: Partial<ContainerData>) => void
}

export function GeneralPanel({ data, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <Accordion type="multiple" defaultValue={['image', 'ports']} className="space-y-0">
      {/* 镜像 & 命令 */}
      <AccordionItem value="image">
        <AccordionTrigger>{t('wizard.image')} &amp; {t('wizard.command')}</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {t('wizard.image')}
              </label>
              <input
                type="text"
                value={data.image}
                onChange={(e) => onChange({ image: e.target.value })}
                placeholder="docker.io/library/nginx:latest"
                className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {t('wizard.command')}
              </label>
              <input
                type="text"
                value={data.exec}
                onChange={(e) => onChange({ exec: e.target.value })}
                placeholder="/usr/sbin/nginx -g 'daemon off;'"
                className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 端口映射 */}
      <AccordionItem value="ports">
        <AccordionTrigger>{t('wizard.publishPort')}</AccordionTrigger>
        <AccordionContent>
          <ChipInput
            items={data.ports.map((p) => `${p.hostPort}:${p.containerPort}/${p.protocol}`)}
            onAdd={(val) => {
              const parts = val.split('/')
              const protocol = parts[1] === 'udp' ? 'udp' : 'tcp'
              const ports = parts[0].split(':')
              if (ports.length >= 2) {
                onChange({ ports: [...data.ports, { hostPort: ports[0], containerPort: ports[1], protocol }] })
              } else if (ports.length === 1) {
                onChange({ ports: [...data.ports, { hostPort: ports[0], containerPort: ports[0], protocol }] })
              }
            }}
            onRemove={(i) => onChange({ ports: data.ports.filter((_, idx) => idx !== i) })}
            onUpdate={(i, val) => {
              const parts = val.split('/')
              const protocol = parts[1] === 'udp' ? 'udp' : 'tcp'
              const ports = parts[0].split(':')
              const newPorts = [...data.ports]
              if (ports.length >= 2) {
                newPorts[i] = { hostPort: ports[0], containerPort: ports[1], protocol }
              }
              onChange({ ports: newPorts })
            }}
            formatItem={(item) => item}
            placeholder={t('wizard.addPort') || 'Add port'}
            addPlaceholder="8080:80/tcp"
          />
        </AccordionContent>
      </AccordionItem>

      {/* 卷挂载 */}
      <AccordionItem value="volumes">
        <AccordionTrigger>{t('wizard.volume')}</AccordionTrigger>
        <AccordionContent>
          <ChipInput
            items={data.volumes.map((v) => `${v.hostPath}:${v.containerPath}:${v.mode}`)}
            onAdd={(val) => {
              const parts = val.split(':')
              if (parts.length >= 2) {
                const mode = parts[2] === 'ro' ? 'ro' : 'rw'
                onChange({ volumes: [...data.volumes, { hostPath: parts[0], containerPath: parts[1], mode }] })
              }
            }}
            onRemove={(i) => onChange({ volumes: data.volumes.filter((_, idx) => idx !== i) })}
            onUpdate={(i, val) => {
              const parts = val.split(':')
              if (parts.length >= 2) {
                const mode = parts[2] === 'ro' ? 'ro' : 'rw'
                const newVolumes = [...data.volumes]
                newVolumes[i] = { hostPath: parts[0], containerPath: parts[1], mode }
                onChange({ volumes: newVolumes })
              }
            }}
            placeholder={t('wizard.addVolume') || 'Add volume'}
            addPlaceholder="/host/path:/container/path:rw"
          />
        </AccordionContent>
      </AccordionItem>

      {/* 环境变量 */}
      <AccordionItem value="env">
        <AccordionTrigger>{t('wizard.environment')}</AccordionTrigger>
        <AccordionContent>
          <KeyValueInput
            items={data.env}
            onAdd={(key, value) => onChange({ env: [...data.env, { key, value }] })}
            onRemove={(i) => onChange({ env: data.env.filter((_, idx) => idx !== i) })}
            onUpdate={(i, key, value) => {
              const newEnv = [...data.env]
              newEnv[i] = { key, value }
              onChange({ env: newEnv })
            }}
            keyPlaceholder="KEY"
            valuePlaceholder="value"
          />
        </AccordionContent>
      </AccordionItem>

      {/* 网络 & 用户 */}
      <AccordionItem value="network">
        <AccordionTrigger>{t('wizard.network')}</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {t('wizard.networkName')}
              </label>
              <input
                type="text"
                value={data.network}
                onChange={(e) => onChange({ network: e.target.value })}
                placeholder="podman"
                className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {t('wizard.hostname')}
              </label>
              <input
                type="text"
                value={data.hostName}
                onChange={(e) => onChange({ hostName: e.target.value })}
                placeholder="my-host"
                className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {t('wizard.uid')}
              </label>
              <input
                type="text"
                value={data.user}
                onChange={(e) => onChange({ user: e.target.value })}
                placeholder="1000"
                className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {t('wizard.gid')}
              </label>
              <input
                type="text"
                value={data.group}
                onChange={(e) => onChange({ group: e.target.value })}
                placeholder="1000"
                className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 标签 */}
      <AccordionItem value="labels">
        <AccordionTrigger>{t('wizard.labels')}</AccordionTrigger>
        <AccordionContent>
          <KeyValueInput
            items={Object.entries(data.labels).map(([key, value]) => ({ key, value }))}
            onAdd={(key, value) => onChange({ labels: { ...data.labels, [key]: value } })}
            onRemove={(i) => {
              const keys = Object.keys(data.labels)
              const newLabels = { ...data.labels }
              delete newLabels[keys[i]]
              onChange({ labels: newLabels })
            })}
            onUpdate={(i, key, value) => {
              const keys = Object.keys(data.labels)
              const oldKey = keys[i]
              const newLabels = { ...data.labels }
              if (oldKey !== key) delete newLabels[oldKey]
              newLabels[key] = value
              onChange({ labels: newLabels })
            }}
            keyPlaceholder="app"
            valuePlaceholder="myapp"
          />
        </AccordionContent>
      </AccordionItem>

      {/* 自动更新 */}
      <AccordionItem value="autoupdate">
        <AccordionTrigger>{t('wizard.autoUpdate')}</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={data.autoUpdate !== ''}
                onCheckedChange={(checked) => {
                  onChange({ autoUpdate: checked ? 'registry' : '' })
                }}
              />
              <span className="text-xs text-text-primary">
                {data.autoUpdate ? t('wizard.autoUpdateEnabled') : t('wizard.autoUpdateDisabled')}
              </span>
            </div>
            {data.autoUpdate && (
              <select
                value={data.autoUpdate}
                onChange={(e) => onChange({ autoUpdate: e.target.value as 'registry' | 'local' | '' })}
                className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="registry">{t('wizard.autoUpdateRegistry')}</option>
                <option value="local">{t('wizard.autoUpdateLocal')}</option>
              </select>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add web/src/components/wizard/panels/GeneralPanel.tsx
git commit -m "feat(wizard): add GeneralPanel with Accordion layout"
```

---

### Task 8: UnitPanel (Tab 2) + ServicePanel (Tab 3)

**Files:**
- Create: `web/src/components/wizard/panels/UnitPanel.tsx`
- Create: `web/src/components/wizard/panels/ServicePanel.tsx`

- [ ] **Step 1: 创建 UnitPanel.tsx**

```tsx
// web/src/components/wizard/panels/UnitPanel.tsx
import { useState, useEffect } from 'react'
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

  const serviceNames = units?.map((u: any) => u.name).filter((n: string) => n.endsWith('.service')) || []

  return (
    <div className="space-y-3">
      {/* 描述 */}
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

      {/* After */}
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

      {/* Requires */}
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

      {/* Wants */}
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

/** 带自动补全的服务名 Chip 输入 */
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
              ×
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
```

- [ ] **Step 2: 创建 ServicePanel.tsx**

```tsx
// web/src/components/wizard/panels/ServicePanel.tsx
import { useTranslation } from 'react-i18next'
import type { ServiceData } from '../types'

interface Props {
  data: ServiceData
  onChange: (data: Partial<ServiceData>) => void
}

export function ServicePanel({ data, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      {/* 重启策略 */}
      <div>
        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {t('wizard.restartPolicy')}
        </label>
        <select
          value={data.restart}
          onChange={(e) => onChange({ restart: e.target.value as ServiceData['restart'] })}
          className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="always">always</option>
          <option value="no">no</option>
          <option value="on-failure">on-failure</option>
          <option value="unless-stopped">unless-stopped</option>
        </select>
      </div>

      {/* 启动超时 */}
      <div>
        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {t('wizard.timeoutStartSec')}
        </label>
        <input
          type="number"
          value={data.timeoutStartSec}
          onChange={(e) => onChange({ timeoutStartSec: e.target.value })}
          placeholder="300"
          min="0"
          className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add web/src/components/wizard/panels/
git commit -m "feat(wizard): add UnitPanel with autocomplete and ServicePanel"
```

---

### Task 9: 重写 ConfigWizard.tsx 主容器

**Files:**
- Modify: `web/src/components/wizard/ConfigWizard.tsx`

- [ ] **Step 1: 重写 ConfigWizard.tsx**

将原来的扁平表单替换为左右分栏 + Tabs 布局。保留导出的 `wizardToQuadlet` 和 `quadletToWizard` 从 convert.ts 重导出。

```tsx
// web/src/components/wizard/ConfigWizard.tsx
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { WizardData } from './types'
import { defaultWizardData } from './defaults'
import { wizardToQuadlet, quadletToWizard } from './convert'
import { GeneralPanel } from './panels/GeneralPanel'
import { UnitPanel } from './panels/UnitPanel'
import { ServicePanel } from './panels/ServicePanel'
import { CodePreview } from './CodePreview'

// Re-export for backward compatibility
export { wizardToQuadlet, quadletToWizard }
export type { WizardData }

interface ConfigWizardProps {
  value: WizardData
  onChange: (data: WizardData) => void
}

export function ConfigWizard({ value, onChange }: ConfigWizardProps) {
  const { t } = useTranslation()
  const data = value

  const updateContainer = useCallback(
    (patch: Partial<WizardData['container']>) => {
      onChange({ ...data, container: { ...data.container, ...patch } })
    },
    [data, onChange]
  )

  const updateUnit = useCallback(
    (patch: Partial<WizardData['unit']>) => {
      onChange({ ...data, unit: { ...data.unit, ...patch } })
    },
    [data, onChange]
  )

  const updateService = useCallback(
    (patch: Partial<WizardData['service']>) => {
      onChange({ ...data, service: { ...data.service, ...patch } })
    },
    [data, onChange]
  )

  // Validation: image is required for Tab 1
  const hasImage = data.container.image.trim().length > 0

  const preview = wizardToQuadlet(data)

  return (
    <div className="flex flex-col md:flex-row gap-3 h-full min-h-0">
      {/* Left: Tabs */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">
              {t('wizard.tabs.general')}
              {!hasImage && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-danger" />
              )}
            </TabsTrigger>
            <TabsTrigger value="unit">{t('wizard.tabs.unit')}</TabsTrigger>
            <TabsTrigger value="service">{t('wizard.tabs.service')}</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralPanel data={data.container} onChange={updateContainer} />
          </TabsContent>
          <TabsContent value="unit">
            <UnitPanel data={data.unit} onChange={updateUnit} />
          </TabsContent>
          <TabsContent value="service">
            <ServicePanel data={data.service} onChange={updateService} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right: Code Preview */}
      <div className="w-full md:w-2/5 border border-border rounded-lg overflow-hidden min-h-[200px] md:min-h-0">
        <CodePreview content={preview} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误（可能有 FilesPage 和 CreateContainerDialog 的类型错误，下一步修复）

- [ ] **Step 3: Commit**

```bash
git add web/src/components/wizard/ConfigWizard.tsx
git commit -m "feat(wizard): rewrite ConfigWizard with Tabs + split view layout"
```

---

### Task 10: 迁移调用点 — FilesPage + CreateContainerDialog

**Files:**
- Modify: `web/src/pages/FilesPage.tsx:8-13,68-71`
- Modify: `web/src/components/container/CreateContainerDialog.tsx:4,14-26`

- [ ] **Step 1: 更新 FilesPage.tsx 的导入和 handleWizardChange**

```typescript
// FilesPage.tsx 第 8-13 行改为：
import {
  ConfigWizard,
  wizardToQuadlet,
  quadletToWizard,
  type WizardData,
} from '@/components/wizard/ConfigWizard'

// 第 68-74 行 handleWizardChange 改为：
const handleWizardChange = useCallback(
  (data: WizardData) => {
    setWizardData(data)
    setContent(wizardToQuadlet(data))
  },
  []
)
```

- [ ] **Step 2: 更新 CreateContainerDialog.tsx**

```typescript
// CreateContainerDialog.tsx 第 4 行改为：
import { ConfigWizard, wizardToQuadlet, defaultWizardData, type WizardData } from '@/components/wizard/ConfigWizard'

// 第 14-26 行 initialData 改为：
const initialData: WizardData = defaultWizardData

// handleSubmit 中设置 unit.description：
const handleSubmit = async () => {
  if (!canSubmit) return
  setSubmitting(true)
  try {
    const filename = `${name.trim()}.container`
    const dataWithName = {
      ...data,
      unit: { ...data.unit, description: data.unit.description || name.trim() },
    }
    const content = wizardToQuadlet(dataWithName)
    await api.applyFile(filename, content)
    // ... rest unchanged
  }
}
```

- [ ] **Step 3: 更新 ConfigWizard.tsx 导出 defaultWizardData**

在 `web/src/components/wizard/ConfigWizard.tsx` 中添加重导出：

```typescript
export { defaultWizardData } from './defaults'
```

- [ ] **Step 4: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/FilesPage.tsx web/src/components/container/CreateContainerDialog.tsx web/src/components/wizard/ConfigWizard.tsx
git commit -m "feat(wizard): migrate FilesPage and CreateContainerDialog to new WizardData"
```

---

### Task 11: i18n 翻译补全

**Files:**
- Modify: `web/src/i18n/zh.json`
- Modify: `web/src/i18n/en.json`

- [ ] **Step 1: 更新 zh.json wizard 部分**

将 `"wizard": { ... }` 替换为：

```json
"wizard": {
  "image": "镜像",
  "command": "命令",
  "publishPort": "端口映射",
  "volume": "卷挂载",
  "environment": "环境变量",
  "network": "网络",
  "hostname": "主机名",
  "userGroup": "用户 / 组",
  "uid": "UID (如 1000)",
  "gid": "GID (如 1000)",
  "restartPolicy": "重启策略",
  "networkName": "网络名称",
  "labels": "标签",
  "tabs": {
    "general": "常规配置",
    "unit": "Unit 依赖",
    "service": "服务配置"
  },
  "autoUpdate": "自动更新",
  "autoUpdateEnabled": "自动更新已启用",
  "autoUpdateDisabled": "自动更新已禁用",
  "autoUpdateRegistry": "Registry（自动拉取新镜像）",
  "autoUpdateLocal": "Local（本地检测变更）",
  "description": "服务描述",
  "after": "启动后依赖 (After)",
  "requires": "强依赖 (Requires)",
  "wants": "弱依赖 (Wants)",
  "timeoutStartSec": "启动超时（秒）",
  "codePreview": "代码预览",
  "addPort": "添加端口",
  "addVolume": "添加卷"
}
```

- [ ] **Step 2: 更新 en.json wizard 部分**

将 `"wizard": { ... }` 替换为：

```json
"wizard": {
  "image": "Image",
  "command": "Command",
  "publishPort": "PublishPort",
  "volume": "Volume",
  "environment": "Environment",
  "network": "Network",
  "hostname": "Hostname",
  "userGroup": "User / Group",
  "uid": "UID (e.g. 1000)",
  "gid": "GID (e.g. 1000)",
  "restartPolicy": "Restart Policy",
  "networkName": "Network name",
  "labels": "Labels",
  "tabs": {
    "general": "General",
    "unit": "Unit Dependencies",
    "service": "Service"
  },
  "autoUpdate": "Auto Update",
  "autoUpdateEnabled": "Auto update enabled",
  "autoUpdateDisabled": "Auto update disabled",
  "autoUpdateRegistry": "Registry (auto pull new images)",
  "autoUpdateLocal": "Local (detect local changes)",
  "description": "Description",
  "after": "After (ordering dependency)",
  "requires": "Requires (strong dependency)",
  "wants": "Wants (weak dependency)",
  "timeoutStartSec": "Start Timeout (seconds)",
  "codePreview": "Code Preview",
  "addPort": "Add port",
  "addVolume": "Add volume"
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add web/src/i18n/zh.json web/src/i18n/en.json
git commit -m "feat(i18n): add wizard tab and dependency translations"
```

---

### Task 12: 最终验证

- [ ] **Step 1: TypeScript 编译检查**

Run: `cd web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: Go 测试**

Run: `go test ./internal/...`
Expected: 全部通过

- [ ] **Step 3: 前端构建**

Run: `cd web && npm run build`
Expected: 构建成功

- [ ] **Step 4: Commit 汇总检查**

Run: `git log --oneline -10`
Expected: 所有 task 的 commit 都在

---

## Verification Checklist

对照 spec 验收标准逐项检查：

- [ ] ConfigWizard 显示为左右分栏布局
- [ ] 3 个 Tab 正确切换，Tab 1 内有 Accordion 折叠面板
- [ ] 端口/卷/环境变量使用结构化对象，Chip 行内编辑
- [ ] AutoUpdate Switch 开启后代码预览高亮联动 Label
- [ ] Tab 标题显示必填项校验红点
- [ ] 依赖输入框有服务名自动补全
- [ ] wizardToQuadlet 生成正确的 INI（含 AutoUpdate 联动）
- [ ] quadletToWizard 正确解析回结构化数据
- [ ] FilesPage 和 CreateContainerDialog 正常工作
- [ ] 中英文 i18n 完整
- [ ] 窄屏响应式切换为上下布局
- [ ] 所有现有测试通过
