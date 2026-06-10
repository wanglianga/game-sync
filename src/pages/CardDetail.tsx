import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Users, Calendar } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import CardDetailTabs from '@/components/CardDetailTabs'

type UserRole = 'planner' | 'programmer' | 'artist'
type CardStatus = 'requirement' | 'development' | 'review' | 'done'
type Priority = 'low' | 'medium' | 'high'

interface Assignee {
  id: string
  name: string
  role: UserRole
}

interface Card {
  id: string
  title: string
  description: string
  status: CardStatus
  progress: number
  priority: Priority
  creator_id: string
  assignees?: Assignee[]
  created_at: string
  updated_at: string
}

interface RequirementDoc {
  content: string
  version: number
  updated_by_name?: string
  updated_at: string
}

interface Asset {
  id: string
  original_name: string
  thumbnail_url: string | null
  url: string
  size: number
  confirmed: boolean
}

interface Commit {
  id: string
  commit_hash: string
  message: string
  url: string | null
  author: string | null
  ref: string | null
  committed_at: string
}

interface Comment {
  id: string
  author_name?: string
  author_role?: UserRole
  content: string
  status: 'open' | 'pending_confirm' | 'closed'
  replies?: Comment[]
  created_at: string
  updated_at: string
}

interface StatusHistory {
  id: string
  from_status: CardStatus | null
  to_status: CardStatus
  triggered_by_name?: string
  created_at: string
}

interface CardDetailData {
  success: boolean
  data: Card & {
    requirement_doc: RequirementDoc | null
    assets: (Asset & { confirmed: boolean })[]
    commits: Commit[]
    comments: Comment[]
    status_history: StatusHistory[]
  }
}

const STATUS_LABELS: Record<CardStatus, string> = {
  requirement: '需求',
  development: '开发中',
  review: '审阅中',
  done: '已完成',
}

const STATUS_COLORS: Record<CardStatus, string> = {
  requirement: 'bg-[var(--warning)]/15 text-[var(--warning)]',
  development: 'bg-[var(--programmer)]/15 text-[var(--programmer)]',
  review: 'bg-[var(--purple)]/15 text-[var(--purple)]',
  done: 'bg-[var(--success)]/15 text-[var(--success)]',
}

const PRIORITY_LABELS: Record<Priority, string> = { low: '低', medium: '中', high: '高' }

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-[var(--success)]/15 text-[var(--success)]',
  medium: 'bg-[var(--warning)]/15 text-[var(--warning)]',
  high: 'bg-[var(--danger)]/15 text-[var(--danger)]',
}

const ROLE_COLORS: Record<UserRole, string> = {
  planner: 'bg-[var(--planner)]',
  programmer: 'bg-[var(--programmer)]',
  artist: 'bg-[var(--artist)]',
}

const ROLE_LABELS: Record<UserRole, string> = {
  planner: '策划',
  programmer: '程序',
  artist: '美术',
}

export default function CardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [data, setData] = useState<CardDetailData['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)

  const fetchCard = useCallback(async () => {
    if (!id) return
    try {
      const res = await api.get<CardDetailData>(`/cards/${id}`)
      setData(res.data)
      setTitleValue(res.data.title)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load card'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCard()
  }, [fetchCard])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center">
        <p className="text-[var(--danger)]">{error || 'Card not found'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-[var(--accent)] hover:underline">
          返回
        </button>
      </div>
    )
  }

  const isPlannerOrCreator =
    user?.role === 'planner' || user?.id === data.creator_id

  const handleSaveTitle = async () => {
    if (!titleValue.trim() || titleValue === data.title) {
      setEditingTitle(false)
      setTitleValue(data.title)
      return
    }
    setSavingTitle(true)
    try {
      await api.put(`/cards/${id}`, { title: titleValue.trim() })
      await fetchCard()
    } catch (err) {
      console.error('Failed to update title', err)
      setTitleValue(data.title)
    } finally {
      setSavingTitle(false)
      setEditingTitle(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-5 flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      {/* Header */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <div className="flex flex-wrap items-start gap-3">
          {editingTitle ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                onBlur={handleSaveTitle}
                autoFocus
                className="flex-1 rounded-lg border border-[var(--accent)] bg-[var(--bg-tertiary)] px-3 py-1.5 font-heading text-xl font-bold text-[var(--text-primary)] focus:outline-none"
              />
              {savingTitle && <Loader2 size={16} className="animate-spin text-[var(--accent)]" />}
            </div>
          ) : (
            <h1
              className={`font-heading text-xl font-bold text-[var(--text-primary)] ${
                isPlannerOrCreator ? 'cursor-pointer hover:text-[var(--accent)]' : ''
              }`}
              onClick={() => isPlannerOrCreator && setEditingTitle(true)}
            >
              {data.title}
            </h1>
          )}

          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[data.status]}`}>
              {STATUS_LABELS[data.status]}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PRIORITY_COLORS[data.priority]}`}>
              {PRIORITY_LABELS[data.priority]}
            </span>
          </div>
        </div>

        {data.description && (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{data.description}</p>
        )}

        {/* Progress bar */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">进度</span>
            <span className="text-xs font-semibold text-[var(--accent)]">{data.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${data.progress}%` }}
            />
          </div>
        </div>

        {/* Assignees & dates */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
          {data.assignees && data.assignees.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Users size={14} />
              {data.assignees.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-1 rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5"
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${ROLE_COLORS[a.role]}`} />
                  {a.name}
                  <span className="text-[10px]">{ROLE_LABELS[a.role]}</span>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            创建 {new Date(data.created_at).toLocaleDateString()}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            更新 {new Date(data.updated_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <CardDetailTabs
          cardId={id!}
          requirementDoc={data.requirement_doc ?? null}
          assets={data.assets ?? []}
          commits={data.commits ?? []}
          comments={data.comments ?? []}
          statusHistory={data.status_history ?? []}
          isPlannerOrCreator={isPlannerOrCreator}
          userRole={user?.role ?? ''}
          onRefresh={() => {
            setLoading(true)
            fetchCard()
          }}
        />
      </div>
    </div>
  )
}
