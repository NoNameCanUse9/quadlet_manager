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
            }}
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
    </Accordion>
  )
}
