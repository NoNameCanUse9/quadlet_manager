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
