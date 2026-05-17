import { NavLink, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Server,
  Container,
  HardDrive,
  Database,
  Network,
  FileText,
  Settings,
  Users,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/useApp'
import { useAuth } from '@/store/useAuth'

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'sidebar.dashboard' },
  { to: '/units', icon: Server, labelKey: 'units.title' },
  { to: '/containers', icon: Container, labelKey: 'sidebar.containers' },
  { to: '/images', icon: HardDrive, labelKey: 'sidebar.images' },
  { to: '/volumes', icon: Database, labelKey: 'sidebar.volumes' },
  { to: '/networks', icon: Network, labelKey: 'sidebar.networks' },
  { to: '/files', icon: FileText, labelKey: 'files.title' },
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
    <aside className="w-56 flex-shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-sm font-bold tracking-widest text-accent uppercase">
          Quadlet Manager
        </h1>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2 text-xs transition-all duration-200',
                isActive
                  ? 'border-l-2 border-accent text-accent bg-accent-dim'
                  : 'border-l-2 border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-raised'
              )
            }
          >
            <item.icon size={14} />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-2 text-xs transition-all duration-200',
                isActive
                  ? 'border-l-2 border-accent text-accent bg-accent-dim'
                  : 'border-l-2 border-transparent text-text-secondary hover:text-text-primary hover:bg-surface-raised'
              )
            }
          >
            <Users size={14} />
            <span>Users</span>
          </NavLink>
        )}
      </nav>

      <div className="border-t border-border px-4 py-3 text-[10px] text-text-muted space-y-2">
        {user && (
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">{user.username} ({user.role})</span>
            <button
              onClick={handleLogout}
              className="p-1 text-text-muted hover:text-danger transition-colors"
              title="Logout"
            >
              <LogOut size={12} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              systemInfo ? 'bg-accent' : 'bg-danger'
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
          <div className="truncate text-text-muted" title={systemInfo.quadletDir}>
            {systemInfo.quadletDir}
          </div>
        )}
      </div>
    </aside>
  )
}
