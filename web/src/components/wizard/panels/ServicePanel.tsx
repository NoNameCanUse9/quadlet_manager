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
