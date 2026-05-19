# ConfigWizard Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HealthCheck UI, ExecStartPre/Post lifecycle hooks, and waitForPaths with strict mountpoint checking to ConfigWizard.

**Architecture:** Extend Phase 1 data model (types already defined), add conversion logic in convert.ts, add UI in ServicePanel and GeneralPanel, diff-highlight in CodePreview.

**Tech Stack:** React 19, TypeScript, Radix UI, Tailwind CSS 4

---

## File Map

| File | Change | Purpose |
|------|--------|---------|
| `web/src/components/wizard/types.ts:56` | Modify | `waitForPaths: string[]` → `WaitForPath[]` |
| `web/src/components/wizard/defaults.ts:21,34` | Modify | `startPeriod: '60s'`, typed waitForPaths |
| `web/src/components/wizard/convert.ts:58-62,168-178` | Modify | HealthCheck + ExecStartPre/Post emission and parsing |
| `web/src/components/wizard/panels/GeneralPanel.tsx:17` | Modify | Add HealthCheck accordion section |
| `web/src/components/wizard/panels/ServicePanel.tsx` | Modify | Add waitForPaths, ExecStartPre, ExecStartPost |
| `web/src/components/wizard/shared/WaitForPathInput.tsx` | Create | Chip input with strict toggle per path |
| `web/src/components/wizard/CodePreview.tsx` | Modify | Diff highlight animation |
| `web/src/styles/globals.css` | Modify | highlight-flash keyframe |
| `web/src/i18n/en.json` | Modify | Phase 2 keys |
| `web/src/i18n/zh.json` | Modify | Phase 2 keys |

---

### Task 1: Update types — WaitForPath interface

**Files:**
- Modify: `web/src/components/wizard/types.ts:56`

- [ ] **Step 1: Add WaitForPath interface and update ServiceData**

In `web/src/components/wizard/types.ts`, add the interface before `ServiceData` (after line 51) and change `waitForPaths` type:

```typescript
/** 等待挂载点 */
export interface WaitForPath {
  path: string
  strict: boolean  // true = mountpoint -q, false = [ -d ]
}
```

Change line 56 from:
```typescript
  waitForPaths: string[]
```
to:
```typescript
  waitForPaths: WaitForPath[]
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/choken/code/quadlet-manager/web && npx tsc --noEmit`
Expected: No errors (defaults.ts will need updating first — do Task 2 immediately after)

- [ ] **Step 3: Commit**

```bash
git add web/src/components/wizard/types.ts
git commit -m "feat(wizard): add WaitForPath type for strict mount checking"
```

---

### Task 2: Update defaults — startPeriod and waitForPaths

**Files:**
- Modify: `web/src/components/wizard/defaults.ts:21,34`

- [ ] **Step 1: Change startPeriod default to 60s**

In `web/src/components/wizard/defaults.ts`, change line 21 from:
```typescript
      startPeriod: '30s',
```
to:
```typescript
      startPeriod: '60s',
```

- [ ] **Step 2: waitForPaths default stays `[]` (compatible with WaitForPath[])**

The existing `waitForPaths: []` on line 34 is already compatible with `WaitForPath[]` since TypeScript infers `never[]` as assignable to any array type. No change needed here.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/choken/code/quadlet-manager/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/components/wizard/defaults.ts
git commit -m "feat(wizard): change HealthCheck startPeriod default to 60s"
```

---

### Task 3: Update convert.ts — emit and parse Phase 2 fields

**Files:**
- Modify: `web/src/components/wizard/convert.ts`

This is the largest task. Two parts: emission (wizardToQuadlet) and parsing (quadletToWizard).

- [ ] **Step 1: Add HealthCheck emission in wizardToQuadlet**

In `web/src/components/wizard/convert.ts`, after the `Network` emission (line 55) and before `lines.push('')` (line 56), add:

```typescript
  // HealthCheck
  if (data.container.healthCheck.enabled && data.container.healthCheck.cmd) {
    lines.push(`HealthCmd=${data.container.healthCheck.cmd}`)
    if (data.container.healthCheck.interval) lines.push(`HealthInterval=${data.container.healthCheck.interval}`)
    if (data.container.healthCheck.retries) lines.push(`HealthRetries=${data.container.healthCheck.retries}`)
    if (data.container.healthCheck.startPeriod) lines.push(`HealthStartPeriod=${data.container.healthCheck.startPeriod}`)
    if (data.container.healthCheck.timeout) lines.push(`HealthTimeout=${data.container.healthCheck.timeout}`)
  }
```

- [ ] **Step 2: Add waitForPaths + ExecStartPre/Post emission in wizardToQuadlet**

In `web/src/components/wizard/convert.ts`, replace the `[Service]` section (lines 58-62) with:

```typescript
  // [Service]
  lines.push('[Service]')
  lines.push(`Restart=${data.service.restart}`)
  lines.push(`TimeoutStartSec=${data.service.timeoutStartSec}`)
  // waitForPaths → ExecStartPre scripts
  for (const wp of data.service.waitForPaths) {
    if (wp.strict) {
      lines.push(`ExecStartPre=/bin/sh -c 'until mountpoint -q ${wp.path}; do sleep 1; done'`)
    } else {
      lines.push(`ExecStartPre=/bin/sh -c 'until [ -d ${wp.path} ]; do sleep 1; done'`)
    }
  }
  for (const cmd of data.service.execStartPre) {
    lines.push(`ExecStartPre=${cmd}`)
  }
  for (const cmd of data.service.execStartPost) {
    lines.push(`ExecStartPost=${cmd}`)
  }
  lines.push('')
```

- [ ] **Step 3: Add HealthCheck parsing in quadletToWizard**

In `web/src/components/wizard/convert.ts`, in the `if (section === 'Container')` block (after line 164), add cases:

```typescript
        case 'HealthCmd': data.container.healthCheck.cmd = val; data.container.healthCheck.enabled = true; break
        case 'HealthInterval': data.container.healthCheck.interval = val; break
        case 'HealthRetries': data.container.healthCheck.retries = parseInt(val, 10) || 3; break
        case 'HealthStartPeriod': data.container.healthCheck.startPeriod = val; break
        case 'HealthTimeout': data.container.healthCheck.timeout = val; break
```

- [ ] **Step 4: Add ExecStartPre/Post parsing with dedup in quadletToWizard**

In `web/src/components/wizard/convert.ts`, replace the `if (section === 'Service')` block (lines 168-178) with:

```typescript
    if (section === 'Service') {
      switch (key) {
        case 'Restart': {
          if (val === 'always' || val === 'on-failure' || val === 'no' || val === 'unless-stopped') {
            data.service.restart = val
          }
          break
        }
        case 'TimeoutStartSec': data.service.timeoutStartSec = val; break
        case 'ExecStartPre': {
          // Dedup: classify waitForPaths vs custom scripts
          const dirMatch = val.match(/until \[ -d (.+?) \]/)
          const mpMatch = val.match(/until mountpoint -q (.+?) /)
          if (dirMatch) {
            data.service.waitForPaths.push({ path: dirMatch[1], strict: false })
          } else if (mpMatch) {
            data.service.waitForPaths.push({ path: mpMatch[1], strict: true })
          } else {
            data.service.execStartPre.push(val)
          }
          break
        }
        case 'ExecStartPost': data.service.execStartPost.push(val); break
      }
    }
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /home/choken/code/quadlet-manager/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add web/src/components/wizard/convert.ts
git commit -m "feat(wizard): add HealthCheck/ExecStartPre/Post emission and parsing with waitForPaths dedup"
```

---

### Task 4: Create WaitForPathInput component

**Files:**
- Create: `web/src/components/wizard/shared/WaitForPathInput.tsx`

- [ ] **Step 1: Write WaitForPathInput component**

Create `web/src/components/wizard/shared/WaitForPathInput.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/choken/code/quadlet-manager/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/wizard/shared/WaitForPathInput.tsx
git commit -m "feat(wizard): add WaitForPathInput component with strict toggle"
```

---

### Task 5: Update ServicePanel — add lifecycle hooks and waitForPaths

**Files:**
- Modify: `web/src/components/wizard/panels/ServicePanel.tsx`

- [ ] **Step 1: Rewrite ServicePanel with new sections**

Replace the entire content of `web/src/components/wizard/panels/ServicePanel.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { ServiceData } from '../types'
import { ChipInput } from '../shared/ChipInput'
import { WaitForPathInput } from '../shared/WaitForPathInput'

interface Props {
  data: ServiceData
  onChange: (data: Partial<ServiceData>) => void
}

export function ServicePanel({ data, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      {/* Restart Policy */}
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

      {/* TimeoutStartSec */}
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

      {/* Wait for Paths */}
      <div>
        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {t('wizard.waitForPaths')}
        </label>
        <p className="text-[10px] text-text-muted mb-1.5">{t('wizard.waitForPathsHint')}</p>
        <WaitForPathInput
          items={data.waitForPaths}
          onAdd={(item) => onChange({ waitForPaths: [...data.waitForPaths, item] })}
          onRemove={(i) => onChange({ waitForPaths: data.waitForPaths.filter((_, idx) => idx !== i) })}
          onUpdate={(i, item) => {
            const newPaths = [...data.waitForPaths]
            newPaths[i] = item
            onChange({ waitForPaths: newPaths })
          }}
          placeholder={t('wizard.addPath') || 'Add path'}
          strictLabel={t('wizard.strictMount')}
        />
      </div>

      {/* ExecStartPre */}
      <div>
        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {t('wizard.execStartPre')}
        </label>
        <ChipInput
          items={data.execStartPre}
          onAdd={(val) => onChange({ execStartPre: [...data.execStartPre, val] })}
          onRemove={(i) => onChange({ execStartPre: data.execStartPre.filter((_, idx) => idx !== i) })}
          onUpdate={(i, val) => {
            const newCmds = [...data.execStartPre]
            newCmds[i] = val
            onChange({ execStartPre: newCmds })
          }}
          placeholder={t('wizard.addScript') || 'Add script'}
          addPlaceholder="/usr/local/bin/pre-script.sh"
        />
      </div>

      {/* ExecStartPost */}
      <div>
        <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
          {t('wizard.execStartPost')}
        </label>
        <ChipInput
          items={data.execStartPost}
          onAdd={(val) => onChange({ execStartPost: [...data.execStartPost, val] })}
          onRemove={(i) => onChange({ execStartPost: data.execStartPost.filter((_, idx) => idx !== i) })}
          onUpdate={(i, val) => {
            const newCmds = [...data.execStartPost]
            newCmds[i] = val
            onChange({ execStartPost: newCmds })
          }}
          placeholder={t('wizard.addScript') || 'Add script'}
          addPlaceholder="/usr/local/bin/post-script.sh"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/choken/code/quadlet-manager/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/wizard/panels/ServicePanel.tsx
git commit -m "feat(wizard): add waitForPaths, ExecStartPre, ExecStartPost to ServicePanel"
```

---

### Task 6: Update GeneralPanel — add HealthCheck accordion

**Files:**
- Modify: `web/src/components/wizard/panels/GeneralPanel.tsx:17`

- [ ] **Step 1: Add HealthCheck accordion section**

In `web/src/components/wizard/panels/GeneralPanel.tsx`, the Accordion `defaultValue` on line 17 currently is `['image', 'ports']`. No change needed — HealthCheck won't be expanded by default.

Add the following after the AutoUpdate `AccordionItem` (after line 244, before the closing `</Accordion>`):

```tsx
      {/* 健康检查 */}
      <AccordionItem value="healthcheck">
        <AccordionTrigger>{t('wizard.healthCheck')}</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={data.healthCheck.enabled}
                onCheckedChange={(checked) => {
                  onChange({
                    healthCheck: { ...data.healthCheck, enabled: checked },
                  })
                }}
              />
              <span className="text-xs text-text-primary">
                {data.healthCheck.enabled ? t('wizard.healthCheckEnabled') : t('wizard.healthCheckDisabled')}
              </span>
            </div>
            {data.healthCheck.enabled && (
              <>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                    {t('wizard.healthCmd')}
                  </label>
                  <input
                    type="text"
                    value={data.healthCheck.cmd}
                    onChange={(e) =>
                      onChange({ healthCheck: { ...data.healthCheck, cmd: e.target.value } })
                    }
                    placeholder="curl -f http://localhost/ || exit 1"
                    className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                      {t('wizard.healthInterval')}
                    </label>
                    <input
                      type="text"
                      value={data.healthCheck.interval}
                      onChange={(e) =>
                        onChange({ healthCheck: { ...data.healthCheck, interval: e.target.value } })
                      }
                      placeholder="10s"
                      className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                      {t('wizard.healthRetries')}
                    </label>
                    <input
                      type="number"
                      value={data.healthCheck.retries}
                      onChange={(e) =>
                        onChange({
                          healthCheck: { ...data.healthCheck, retries: parseInt(e.target.value, 10) || 0 },
                        })
                      }
                      min="0"
                      className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                      {t('wizard.healthStartPeriod')}
                    </label>
                    <input
                      type="text"
                      value={data.healthCheck.startPeriod}
                      onChange={(e) =>
                        onChange({ healthCheck: { ...data.healthCheck, startPeriod: e.target.value } })
                      }
                      placeholder="60s"
                      className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                    <p className="text-[9px] text-text-muted mt-0.5">{t('wizard.healthStartPeriodHint')}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">
                      {t('wizard.healthTimeout')}
                    </label>
                    <input
                      type="text"
                      value={data.healthCheck.timeout}
                      onChange={(e) =>
                        onChange({ healthCheck: { ...data.healthCheck, timeout: e.target.value } })
                      }
                      placeholder="5s"
                      className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/choken/code/quadlet-manager/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/wizard/panels/GeneralPanel.tsx
git commit -m "feat(wizard): add HealthCheck accordion to GeneralPanel"
```

---

### Task 7: Update CodePreview — diff highlight animation

**Files:**
- Modify: `web/src/components/wizard/CodePreview.tsx`
- Modify: `web/src/styles/globals.css`

- [ ] **Step 1: Add highlight keyframe to globals.css**

In `web/src/styles/globals.css`, add before the closing `}` of `@layer base` (before line 60):

```css
@keyframes highlight-flash {
  0% { background-color: rgba(16, 185, 129, 0.15); }
  100% { background-color: transparent; }
}
```

- [ ] **Step 2: Update CodePreview with diff tracking**

Replace the entire content of `web/src/components/wizard/CodePreview.tsx`:

```tsx
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/choken/code/quadlet-manager/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/components/wizard/CodePreview.tsx web/src/styles/globals.css
git commit -m "feat(wizard): add diff highlight animation to CodePreview"
```

---

### Task 8: Add i18n translations

**Files:**
- Modify: `web/src/i18n/en.json`
- Modify: `web/src/i18n/zh.json`

- [ ] **Step 1: Add Phase 2 keys to en.json**

In `web/src/i18n/en.json`, add these keys inside the `"wizard"` object (after `"addVolume"`):

```json
    "healthCheck": "Health Check",
    "healthCheckEnabled": "Health check enabled",
    "healthCheckDisabled": "Health check disabled",
    "healthCmd": "Health Command",
    "healthInterval": "Check Interval",
    "healthRetries": "Retries",
    "healthStartPeriod": "Start Period",
    "healthStartPeriodHint": "Slow-start services may need 60s-120s",
    "healthTimeout": "Timeout",
    "waitForPaths": "Wait for Paths",
    "waitForPathsHint": "Auto-generates ExecStartPre scripts to wait for mount points",
    "strictMount": "Strict",
    "execStartPre": "Pre-start Script",
    "execStartPost": "Post-start Script",
    "addPath": "Add path",
    "addScript": "Add script"
```

- [ ] **Step 2: Add Phase 2 keys to zh.json**

In `web/src/i18n/zh.json`, add these keys inside the `"wizard"` object (after `"addVolume"`):

```json
    "healthCheck": "健康检查",
    "healthCheckEnabled": "健康检查已启用",
    "healthCheckDisabled": "健康检查已禁用",
    "healthCmd": "检查命令",
    "healthInterval": "检查间隔",
    "healthRetries": "重试次数",
    "healthStartPeriod": "启动宽限期",
    "healthStartPeriodHint": "慢启动服务建议设置 60s-120s",
    "healthTimeout": "超时时间",
    "waitForPaths": "等待挂载点",
    "waitForPathsHint": "自动生成 ExecStartPre 脚本等待挂载点就绪",
    "strictMount": "严格模式",
    "execStartPre": "启动前脚本",
    "execStartPost": "启动后脚本",
    "addPath": "添加路径",
    "addScript": "添加脚本"
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/choken/code/quadlet-manager/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/i18n/en.json web/src/i18n/zh.json
git commit -m "feat(wizard): add Phase 2 i18n translations for HealthCheck and lifecycle hooks"
```

---

### Task 9: Final verification

- [ ] **Step 1: TypeScript check**

Run: `cd /home/choken/code/quadlet-manager/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Frontend build**

Run: `cd /home/choken/code/quadlet-manager/web && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Go tests**

Run: `cd /home/choken/code/quadlet-manager && go test ./internal/...`
Expected: All tests pass

- [ ] **Step 4: Verify i18n key consistency**

Run: `cd /home/choken/code/quadlet-manager/web && node -e "const en=require('./src/i18n/en.json');const zh=require('./src/i18n/zh.json');const enW=Object.keys(en.wizard).sort();const zhW=Object.keys(zh.wizard).sort();console.log('EN wizard keys:',enW.length);console.log('ZH wizard keys:',zhW.length);const missing=enW.filter(k=>!zhW.includes(k));if(missing.length)console.log('Missing in ZH:',missing);else console.log('All keys match')" `
Expected: All keys match
