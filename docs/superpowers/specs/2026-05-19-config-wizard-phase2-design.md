# ConfigWizard Phase 2 — HealthCheck, Lifecycle Hooks, waitForPaths

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HealthCheck configuration UI, ExecStartPre/Post lifecycle hooks, and waitForPaths mount-point waiting with auto-generated shell scripts to the ConfigWizard.

**Architecture:** Extend existing Phase 1 data model (types already defined), add conversion logic in `convert.ts`, add UI panels in `ServicePanel.tsx` and `GeneralPanel.tsx`, and implement live diff-highlight in `CodePreview.tsx`.

**Tech Stack:** React 19, TypeScript, Radix UI (Accordion/Switch), Tailwind CSS 4

---

## 1. Data Model Changes

### 1.1 `waitForPaths` type change

**File:** `web/src/components/wizard/types.ts`

Current `waitForPaths: string[]` needs to become structured:

```typescript
export interface WaitForPath {
  path: string
  strict: boolean  // true = mountpoint -q, false = [ -d ]
}

// In ServiceData:
waitForPaths: WaitForPath[]
```

### 1.2 Default value update

**File:** `web/src/components/wizard/defaults.ts`

```typescript
waitForPaths: []  // WaitForPath[] — same shape, just typed
```

### 1.3 HealthCheck default change

**File:** `web/src/components/wizard/defaults.ts`

```typescript
healthCheck: {
  enabled: false,
  cmd: '',
  interval: '10s',
  retries: 3,
  startPeriod: '60s',  // changed from '30s' — slow-start services need more time
  timeout: '5s',
}
```

---

## 2. Conversion Logic

### 2.1 `wizardToQuadlet` — emit Phase 2 fields

**File:** `web/src/components/wizard/convert.ts`

**HealthCheck → `[Container]` section keys:**
```
HealthCmd=curl -f http://localhost/
HealthInterval=10s
HealthRetries=3
HealthStartPeriod=60s
HealthTimeout=5s
```
Only emitted when `healthCheck.enabled === true` and `healthCheck.cmd` is non-empty.

**ExecStartPre/Post + waitForPaths → `[Service]` section:**
```
# waitForPaths with strict=false:
ExecStartPre=/bin/sh -c 'until [ -d /data ]; do sleep 1; done'
# waitForPaths with strict=true:
ExecStartPre=/bin/sh -c 'until mountpoint -q /data; do sleep 1; done'
# User-defined exec hooks:
ExecStartPre=/usr/local/bin/pre-script.sh
ExecStartPost=/usr/local/bin/post-script.sh
```

Ordering in output: waitForPaths entries first, then user-defined execStartPre, then execStartPost.

### 2.2 `quadletToWizard` — reverse parse Phase 2 fields

**File:** `web/src/components/wizard/convert.ts`

**HealthCheck parsing:** Read `HealthCmd`, `HealthInterval`, `HealthRetries`, `HealthStartPeriod`, `HealthTimeout` from `[Container]` section. If `HealthCmd` exists, set `healthCheck.enabled = true`.

**ExecStartPre dedup and classification:**
- Regex `/until \[ -d (.+) \]/` → path goes to `waitForPaths` with `strict: false`
- Regex `/until mountpoint -q (.+)/` → path goes to `waitForPaths` with `strict: true`
- Anything else → goes to `execStartPre`

**ExecStartPost:** Directly parsed into `execStartPost` array.

---

## 3. UI Components

### 3.1 HealthCheck Accordion — GeneralPanel

**File:** `web/src/components/wizard/panels/GeneralPanel.tsx`

New Accordion section `value="healthcheck"`:
- Switch toggle for `healthCheck.enabled`
- When enabled, show fields:
  - HealthCmd — text input (required)
  - HealthInterval — text input (default "10s")
  - HealthRetries — number input (default 3)
  - HealthStartPeriod — text input (default "60s") with tooltip: "慢启动服务建议设置更长时间（如 60s-120s），避免容器在就绪前被标记为失败"
  - HealthTimeout — text input (default "5s")

### 3.2 Lifecycle Hooks — ServicePanel

**File:** `web/src/components/wizard/panels/ServicePanel.tsx`

Add after existing Restart/Timeout fields:

**waitForPaths section:**
- Label: "等待挂载点 (Wait for Paths)"
- ChipInput for paths, each chip has:
  - Path text display
  - Small toggle switch (strict mode) — tooltip: "严格模式: 检查是否为挂载点 (mountpoint -q)"
- When strict=true, chip shows a small badge/icon

**ExecStartPre section:**
- Label: "启动前脚本 (ExecStartPre)"
- ChipInput for commands

**ExecStartPost section:**
- Label: "启动后脚本 (ExecStartPost)"
- ChipInput for commands

### 3.3 Code Preview Diff Highlight — CodePreview

**File:** `web/src/components/wizard/CodePreview.tsx`

- Track previous INI content vs current
- On change, identify added/modified lines
- Apply brief CSS animation (background flash, ~500ms) to changed lines
- Implementation: compare line-by-line, wrap changed lines in `<span>` with `animate-highlight` class

**File:** `web/src/styles/globals.css`

```css
@keyframes highlight-flash {
  0% { background-color: rgba(16, 185, 129, 0.2); }
  100% { background-color: transparent; }
}
.animate-highlight {
  animation: highlight-flash 0.5s ease-out;
}
```

---

## 4. i18n Keys

**Files:** `web/src/i18n/en.json`, `web/src/i18n/zh.json`

New keys needed:

| Key | EN | ZH |
|-----|----|----|
| `wizard.healthCheck` | Health Check | 健康检查 |
| `wizard.healthCmd` | Health Command | 健康检查命令 |
| `wizard.healthInterval` | Check Interval | 检查间隔 |
| `wizard.healthRetries` | Retries | 重试次数 |
| `wizard.healthStartPeriod` | Start Period | 启动宽限期 |
| `wizard.healthTimeout` | Timeout | 超时时间 |
| `wizard.healthStartPeriodHint` | Slow-start services may need 60s-120s | 慢启动服务建议设置 60s-120s |
| `wizard.waitForPaths` | Wait for Paths | 等待挂载点 |
| `wizard.waitForPathsHint` | Auto-generates ExecStartPre scripts to wait for mount points | 自动生成 ExecStartPre 脚本等待挂载点就绪 |
| `wizard.strictMount` | Strict (check mountpoint) | 严格模式 (检查挂载点) |
| `wizard.execStartPre` | Pre-start Script | 启动前脚本 |
| `wizard.execStartPost` | Post-start Script | 启动后脚本 |
| `wizard.addPath` | Add path | 添加路径 |
| `wizard.addScript` | Add script | 添加脚本 |

---

## 5. File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `web/src/components/wizard/types.ts` | Modify | Add `WaitForPath` interface, change `waitForPaths` type |
| `web/src/components/wizard/defaults.ts` | Modify | Update `waitForPaths` default, change `startPeriod` to 60s |
| `web/src/components/wizard/convert.ts` | Modify | Add HealthCheck/ExecStartPre/Post emission and parsing |
| `web/src/components/wizard/panels/GeneralPanel.tsx` | Modify | Add HealthCheck accordion section |
| `web/src/components/wizard/panels/ServicePanel.tsx` | Modify | Add waitForPaths, ExecStartPre, ExecStartPost sections |
| `web/src/components/wizard/CodePreview.tsx` | Modify | Add diff highlight animation |
| `web/src/styles/globals.css` | Modify | Add highlight-flash keyframe |
| `web/src/i18n/en.json` | Modify | Add Phase 2 translation keys |
| `web/src/i18n/zh.json` | Modify | Add Phase 2 translation keys |

---

## 6. Verification

1. `npx tsc --noEmit` — TypeScript compiles clean
2. `npm run build` — Frontend builds successfully
3. Manual test: create container with HealthCheck enabled → verify INI output has HealthCmd etc.
4. Manual test: add waitForPaths → verify ExecStartPre generated correctly
5. Manual test: import existing .container with ExecStartPre → verify reverse parsing classifies correctly
6. Manual test: code preview highlights changed lines on edit
