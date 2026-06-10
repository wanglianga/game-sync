import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  Image,
  GitBranch,
  Bell,
  LogOut,
  Menu,
  X,
  Plus,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useNotificationStore } from '@/store/notifications'

const NAV_ITEMS = [
  { to: '/', label: '同步墙', icon: LayoutDashboard, end: true },
  { to: '/', label: '功能卡片', icon: CreditCard, end: false },
  { to: '/assets', label: '素材管理', icon: Image, end: false },
  { to: '/webhooks', label: 'Webhook', icon: GitBranch, end: false },
]

const ROLE_COLORS: Record<string, string> = {
  planner: 'bg-[var(--planner)]',
  programmer: 'bg-[var(--programmer)]',
  artist: 'bg-[var(--artist)]',
}

const ROLE_LABELS: Record<string, string> = {
  planner: '策划',
  programmer: '程序',
  artist: '美术',
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleColor = user ? ROLE_COLORS[user.role] ?? 'bg-[var(--accent)]' : 'bg-[var(--accent)]'
  const roleLabel = user ? ROLE_LABELS[user.role] ?? user.role : ''

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-40 flex h-full w-56 flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)] transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-[var(--bg-primary)]">
            GS
          </div>
          <span className="font-heading text-lg font-bold tracking-tight text-[var(--text-primary)]">
            GameSync
          </span>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} className="text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Nav */}
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}

          {user?.role === 'planner' && (
            <button
              onClick={() => {
                navigate('/card/new')
                setMobileOpen(false)
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)]"
            >
              <Plus size={16} />
              创建卡片
            </button>
          )}
        </nav>

        {/* User section */}
        {user && (
          <div className="border-t border-[var(--border)] p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-xs font-bold text-[var(--text-primary)]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {user.name}
                </p>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${roleColor}`}
                >
                  {roleLabel}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--danger)]"
            >
              <LogOut size={16} />
              退出登录
            </button>
          </div>
        )}
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-secondary)] px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} className="text-[var(--text-secondary)]" />
            </button>
            <h1 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
              GameSync
            </h1>
          </div>

          <button className="relative rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
