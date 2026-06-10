import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
type Priority = 'low' | 'medium' | 'high'

interface CreateResponse {
  success: boolean
  data: { id: string }
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30',
  medium: 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30',
  high: 'bg-[var(--danger)]/15 text-[var(--danger)] border-[var(--danger)]/30',
}

export default function NewCard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user && user.role !== 'planner') {
      navigate('/')
    }
  }, [user, navigate])

  if (!user || user.role !== 'planner') return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post<CreateResponse>('/cards', {
        title: title.trim(),
        description: description.trim(),
        priority,
      })
      navigate(`/card/${res.data.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create card'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={16} />
        返回
      </button>

      <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">
        创建功能卡片
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        填写信息创建新的功能卡片
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            标题 <span className="text-[var(--danger)]">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入卡片标题"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述功能需求..."
            rows={5}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
            优先级
          </label>
          <div className="flex gap-3">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`rounded-lg border px-5 py-2 text-sm font-medium transition-all ${
                  priority === p.value
                    ? PRIORITY_COLORS[p.value]
                    : 'border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-50"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            创建
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
