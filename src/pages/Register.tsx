import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useNotificationStore } from '@/store/notifications'
import { api } from '@/lib/api'
import type { UserRole } from '../../shared/types'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('DEMO2024')
  const [role, setRole] = useState<UserRole>('planner')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const connectWS = useNotificationStore((s) => s.connectWS)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ token: string; user: Parameters<typeof login>[1] }>(
        '/auth/register',
        { name, email, password, role, inviteCode }
      )
      login(res.token, res.user)
      connectWS(res.token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const roles: { value: UserRole; label: string; color: string }[] = [
    { value: 'planner', label: '策划', color: 'var(--planner)' },
    { value: 'programmer', label: '程序', color: 'var(--programmer)' },
    { value: 'artist', label: '美术', color: 'var(--artist)' },
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-lg font-bold text-[var(--bg-primary)]">
            GS
          </div>
          <h1 className="font-heading text-xl font-bold text-[var(--text-primary)]">
            注册 GameSync
          </h1>
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">昵称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-[var(--text-secondary)]">角色</label>
            <div className="flex gap-2">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    role === r.value
                      ? 'border-transparent text-white'
                      : 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                  }`}
                  style={role === r.value ? { backgroundColor: r.color } : undefined}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">邀请码</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              placeholder="输入团队邀请码"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
          已有账号？{' '}
          <Link to="/login" className="text-[var(--accent)] hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  )
}
