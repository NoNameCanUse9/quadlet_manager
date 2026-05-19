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

/** 等待挂载点 */
export interface WaitForPath {
  path: string
  strict: boolean  // true = mountpoint -q, false = [ -d ]
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
  waitForPaths: WaitForPath[]
  execStartPre: string[]
  execStartPost: string[]
}

export interface WizardData {
  container: ContainerData
  unit: UnitData
  service: ServiceData
}
