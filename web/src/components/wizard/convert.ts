import type { WizardData, PortMapping, VolumeMount } from './types'
import { defaultWizardData } from './defaults'

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
  // HealthCheck
  if (data.container.healthCheck.enabled && data.container.healthCheck.cmd) {
    lines.push(`HealthCmd=${data.container.healthCheck.cmd}`)
    if (data.container.healthCheck.interval) lines.push(`HealthInterval=${data.container.healthCheck.interval}`)
    if (data.container.healthCheck.retries) lines.push(`HealthRetries=${data.container.healthCheck.retries}`)
    if (data.container.healthCheck.startPeriod) lines.push(`HealthStartPeriod=${data.container.healthCheck.startPeriod}`)
    if (data.container.healthCheck.timeout) lines.push(`HealthTimeout=${data.container.healthCheck.timeout}`)
  }
  lines.push('')

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

  // [Install]
  lines.push('[Install]')
  lines.push('WantedBy=default.target')

  return lines.join('\n')
}

function parsePort(val: string): PortMapping | null {
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
  const parts = val.split(':')
  if (parts.length >= 2) {
    const mode = parts[2] === 'ro' ? 'ro' : 'rw'
    return { hostPath: parts[0], containerPath: parts[1], mode }
  }
  return null
}

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
        case 'HealthCmd': data.container.healthCheck.cmd = val; data.container.healthCheck.enabled = true; break
        case 'HealthInterval': data.container.healthCheck.interval = val; break
        case 'HealthRetries': data.container.healthCheck.retries = parseInt(val, 10) || 3; break
        case 'HealthStartPeriod': data.container.healthCheck.startPeriod = val; break
        case 'HealthTimeout': data.container.healthCheck.timeout = val; break
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
  }

  return data
}
