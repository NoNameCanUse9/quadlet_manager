import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApp } from '@/store/useApp'
import { api, type UserSettings, type UpdateInfo } from '@/api/client'
import i18n from '@/i18n'

export function SettingsPage() {
  const { t } = useTranslation()
  const systemInfo = useApp((s) => s.systemInfo)
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [quadletDir, setQuadletDir] = useState('')
  const [podmanSocket, setPodmanSocket] = useState('')
  const [mirrorRegistry, setMirrorRegistry] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s)
      setQuadletDir(s.quadlet_dir || '')
      setPodmanSocket(s.podman_socket || '')
      setMirrorRegistry(s.mirror_registry || '')
    }).catch(() => {})
  }, [])

  const { data: updateInfo } = useQuery<UpdateInfo>({
    queryKey: ['update-info'],
    queryFn: api.getUpdateInfo,
    retry: false,
  })

  const checkMutation = useMutation({
    mutationFn: () => api.checkUpdate(),
    onSuccess: (data) => {
      queryClient.setQueryData(['update-info'], data)
    },
  })

  const save = async (fields: Record<string, unknown>) => {
    setSaving(true)
    setMsg('')
    try {
      await api.updateSettings(fields)
      setMsg(t('common.success'))
    } catch {
      setMsg(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-base font-bold tracking-wider text-text-primary uppercase">
        {t('settings.title')}
      </h2>

      <div className="border border-border rounded-lg bg-surface divide-y divide-border">
        <SettingsRow label={t('settings.language')}>
          <select
            value={i18n.language}
            onChange={(e) => {
              i18n.changeLanguage(e.target.value)
              save({ language: e.target.value })
            }}
            className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </SettingsRow>

        <SettingsRow label={t('settings.rootless')}>
          <span className="text-sm text-text-secondary">
            {systemInfo ? (systemInfo.rootless ? t('common.yes') : t('common.no')) : '-'}
          </span>
        </SettingsRow>

        <SettingsRow label={t('settings.quadletDir')}>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={quadletDir}
              onChange={(e) => setQuadletDir(e.target.value)}
              placeholder={systemInfo?.quadletDir || '~/.config/containers/systemd/'}
              className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary font-mono w-96 focus:outline-none focus:border-accent"
            />
            <button
              disabled={saving || quadletDir === (settings?.quadlet_dir || '')}
              onClick={() => save({ quadlet_dir: quadletDir })}
              className="px-3 py-1.5 text-sm rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('settings.save')}
            </button>
          </div>
        </SettingsRow>

        <SettingsRow label={t('settings.podmanSocket')}>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={podmanSocket}
              onChange={(e) => setPodmanSocket(e.target.value)}
              placeholder={systemInfo ? (systemInfo.rootless ? '/run/user/1000/podman/podman.sock' : '/run/podman/podman.sock') : ''}
              className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary font-mono w-96 focus:outline-none focus:border-accent"
            />
            <button
              disabled={saving || podmanSocket === (settings?.podman_socket || '')}
              onClick={() => save({ podman_socket: podmanSocket })}
              className="px-3 py-1.5 text-sm rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('settings.save')}
            </button>
          </div>
        </SettingsRow>

        <SettingsRow label={t('settings.mirrorRegistry')}>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={mirrorRegistry}
              onChange={(e) => setMirrorRegistry(e.target.value)}
              placeholder="e.g. docker.io"
              className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary font-mono w-96 focus:outline-none focus:border-accent"
            />
            <button
              disabled={saving || mirrorRegistry === (settings?.mirror_registry || '')}
              onClick={() => save({ mirror_registry: mirrorRegistry })}
              className="px-3 py-1.5 text-sm rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('settings.save')}
            </button>
          </div>
        </SettingsRow>
      </div>

      {msg && (
        <p className={`text-sm ${msg === t('common.success') ? 'text-green-400' : 'text-red-400'}`}>
          {msg}
        </p>
      )}

      {/* About Section */}
      <h3 className="text-sm font-bold tracking-wider text-text-primary uppercase">
        {t('settings.about.title')}
      </h3>

      <div className="border border-border rounded-lg bg-surface divide-y divide-border">
        <SettingsRow label={t('settings.about.currentVersion')}>
          <span className="text-sm text-text-secondary font-mono">
            {updateInfo?.current || systemInfo?.version || 'dev'}
          </span>
        </SettingsRow>

        <SettingsRow label={t('settings.about.latestVersion')}>
          {updateInfo?.hasUpdate ? (
            <span className="text-sm text-blue-400 font-mono">
              {updateInfo.latest}
              <span className="ml-2 text-xs text-blue-400/70">({t('settings.about.hasUpdate')})</span>
            </span>
          ) : (
            <span className="text-sm text-text-secondary font-mono">
              {updateInfo?.latest || '-'}
              {updateInfo && <span className="ml-2 text-xs text-green-400/70">({t('settings.about.noUpdate')})</span>}
            </span>
          )}
        </SettingsRow>

        {updateInfo?.checkedAt && (
          <SettingsRow label={t('settings.about.lastChecked')}>
            <span className="text-sm text-text-secondary">
              {new Date(updateInfo.checkedAt).toLocaleString()}
            </span>
          </SettingsRow>
        )}

        <div className="px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
            className="px-3 py-1.5 text-sm rounded bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {checkMutation.isPending ? '...' : t('settings.about.checkUpdate')}
          </button>
          {updateInfo?.hasUpdate && updateInfo.downloadUrl && (
            <a
              href={updateInfo.downloadUrl}
              className="px-3 py-1.5 text-sm rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-semibold"
            >
              {t('settings.about.downloadBinary')}
            </a>
          )}
          {updateInfo?.hasUpdate && updateInfo.releaseUrl && (
            <a
              href={updateInfo.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-sm rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
            >
              {t('settings.about.goToDownload')}
            </a>
          )}
        </div>

        {updateInfo?.releaseNote && (
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">
              {t('settings.about.releaseNotes')}
            </p>
            <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono max-h-48 overflow-auto">
              {updateInfo.releaseNote}
            </pre>
          </div>
        )}
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
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-sm text-text-secondary">{label}</span>
      {children}
    </div>
  )
}
