import { NavLink, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Container,
  HardDrive,
  Database,
  Network,
  FileText,
  Settings,
  Users,
  LogOut,
  Archive,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/useApp'
import { useAuth } from '@/store/useAuth'

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'sidebar.dashboard' },
  { to: '/containers', icon: Container, labelKey: 'sidebar.containers' },
  { to: '/images', icon: HardDrive, labelKey: 'sidebar.images' },
  { to: '/volumes', icon: Database, labelKey: 'sidebar.volumes' },
  { to: '/networks', icon: Network, labelKey: 'sidebar.networks' },
  { to: '/files', icon: FileText, labelKey: 'files.title' },
  { to: '/backup', icon: Archive, labelKey: 'backup.title' },
  { to: '/settings', icon: Settings, labelKey: 'sidebar.settings' },
]

export function AppSidebar() {
  const { t } = useTranslation()
  const systemInfo = useApp((s) => s.systemInfo)
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-64 flex-shrink-0 border-r border-border bg-surface flex flex-col transition-all duration-200">
      {/* Brand Header: Set to exact h-16 (64px) for perfect topbar border alignment */}
      <div className="h-16 px-6 border-b border-border flex items-center gap-2.5 flex-shrink-0">
        <div className="w-2 h-6 bg-accent rounded-full animate-pulse" />
        <h1 className="text-base font-extrabold tracking-widest text-accent uppercase">
          Quadlet Manager
        </h1>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3.5 px-6 py-2.5 text-sm font-semibold transition-all duration-200 border-l-2',
                isActive
                  ? 'border-accent text-accent bg-accent-dim'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-raised/60'
              )
            }
          >
            <item.icon size={17} />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}

        {/* Admin Navigation */}
        {user?.role === 'admin' && (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3.5 px-6 py-2.5 text-sm font-semibold transition-all duration-200 border-l-2',
                isActive
                  ? 'border-accent text-accent bg-accent-dim'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-raised/60'
              )
            }
          >
            <Users size={17} />
            <span>{t('users.title') || 'Users'}</span>
          </NavLink>
        )}
      </nav>

      {/* Bottom Status & User Panel */}
      <div className="border-t border-border px-6 py-4 text-xs text-text-muted space-y-3 bg-surface-raised/10">
        {user && (
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <div className="flex flex-col truncate pr-2">
              <span className="text-text-primary font-bold truncate">{user.username}</span>
              <span className="text-[10px] text-text-muted uppercase font-semibold tracking-wider">
                {user.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 font-medium">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              systemInfo ? 'bg-accent' : 'bg-red-500 animate-pulse'
            )}
          />
          <span>
            {systemInfo
              ? systemInfo.rootless
                ? t('common.rootless')
                : t('common.rootful')
              : t('common.disconnected')}
          </span>
        </div>

        {systemInfo && (
          <div
            className="truncate text-[10px] font-mono text-text-muted bg-surface-raised/50 border border-border/40 rounded px-2 py-1 select-all hover:border-accent/40 transition-colors"
            title={systemInfo.quadletDir}
          >
            {systemInfo.quadletDir}
          </div>
        )}
      </div>
    </aside>
  )
}
