import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useNotificationStore } from '@/store/notifications'
import { api } from '@/lib/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const login = useAuthStore((s) => s.login)
  const connectWS = useNotificationStore((s) => s.connectWS)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await api.post<{ token: string; user: Parameters<typeof login>[1] }>(
        '/auth/login',
        { email, password }
      )
      login(res.token, res.user)
      connectWS(res.token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-lg font-bold text-[var(--bg-primary)]">
            GS
          </div>
          <h1 className="font-heading text-xl font-bold text-[var(--text-primary)]">
            登录 GameSync
          </h1>
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-semibold text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)]"
          >
            登录
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
          没有账号？{' '}
          <Link to="/register" className="text-[var(--accent)] hover:underline">
            注册
          </Link>
        </p>
      </div>
    </div>
  )
}
