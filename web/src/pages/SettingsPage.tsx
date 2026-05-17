import { useTranslation } from 'react-i18next'
import { useApp } from '@/store/useApp'
import i18n from '@/i18n'

export function SettingsPage() {
  const { t } = useTranslation()
  const systemInfo = useApp((s) => s.systemInfo)

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
        {t('settings.title')}
      </h2>

      <div className="border border-border rounded bg-surface divide-y divide-border">
        <SettingsRow label={t('settings.language')}>
          <select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            className="bg-surface-raised border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </SettingsRow>

        <SettingsRow label={t('settings.rootless')}>
          <span className="text-xs text-text-secondary">
            {systemInfo ? (systemInfo.rootless ? t('common.yes') : t('common.no')) : '-'}
          </span>
        </SettingsRow>

        <SettingsRow label={t('settings.quadletDir')}>
          <span className="text-xs text-text-muted font-mono break-all">
            {systemInfo?.quadletDir || '-'}
          </span>
        </SettingsRow>

        <SettingsRow label={t('settings.podmanSocket')}>
          <span className="text-xs text-text-muted font-mono">
            {systemInfo ? (systemInfo.rootless ? '/run/user/...' : '/run/podman/podman.sock') : '-'}
          </span>
        </SettingsRow>
      </div>
    </div>
  )
}

function SettingsRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-text-secondary">{label}</span>
      {children}
    </div>
  )
}
