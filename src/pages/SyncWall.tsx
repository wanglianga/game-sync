import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Plus, Image, GitCommit, MessageCircle, Filter, User } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

type CardStatus = 'requirement' | 'development' | 'review' | 'done'
type Priority = 'low' | 'medium' | 'high'
type UserRole = 'planner' | 'programmer' | 'artist'

interface Assignee { id: string; name: string; role: UserRole }
interface Card {
  id: string; title: string; description: string; status: CardStatus
  progress: number; priority: Priority; creator_name?: string
  creator_role?: UserRole; assignees?: Assignee[]; asset_count?: number
  commit_count?: number; pending_review_count?: number; created_at: string; updated_at: string
}

const COLUMNS: { key: CardStatus; label: string; color: string }[] = [
  { key: 'requirement', label: '需求中', color: 'bg-warning' },
  { key: 'development', label: '开发中', color: 'bg-programmer' },
  { key: 'review', label: '待确认', color: 'bg-purple' },
  { key: 'done', label: '已完成', color: 'bg-success' },
]

const PRIORITY_STYLE: Record<Priority, { bg: string; label: string }> = {
  high: { bg: 'bg-danger', label: '高' },
  medium: { bg: 'bg-warning', label: '中' },
  low: { bg: 'bg-success', label: '低' },
}

const ROLE_BORDER: Record<UserRole, string> = {
  planner: 'border-planner',
  programmer: 'border-programmer',
  artist: 'border-artist',
}

function KanbanCard({ card, onClick }: { card: Card; onClick: () => void }) {
  const gradColor = card.progress >= 100 ? '#7c5cfc' : '#00d4aa'
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-border bg-bg-card p-3 transition-all hover:border-accent/50 hover:shadow-[0_0_12px_rgba(0,212,170,0.15)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-text-primary line-clamp-1">{card.title}</span>
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white', PRIORITY_STYLE[card.priority].bg)}>
          {PRIORITY_STYLE[card.priority].label}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-bg-tertiary">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${card.progress}%`, background: `linear-gradient(90deg, #00d4aa, ${gradColor})` }} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {(card.assignees ?? []).slice(0, 3).map((a) => (
            <div key={a.id} className={cn('flex h-5 w-5 items-center justify-center rounded-full border bg-bg-tertiary text-[8px] font-bold text-text-primary', ROLE_BORDER[a.role])}>
              {a.name.charAt(0)}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5 text-text-muted">
          {card.asset_count != null && <span className="flex items-center gap-0.5 text-[10px]"><Image size={10} />{card.asset_count}</span>}
          {card.commit_count != null && <span className="flex items-center gap-0.5 text-[10px]"><GitCommit size={10} />{card.commit_count}</span>}
          {card.pending_review_count != null && <span className="flex items-center gap-0.5 text-[10px]"><MessageCircle size={10} />{card.pending_review_count}</span>}
        </div>
      </div>
    </div>
  )
}

function CardColumn({ col, cards, onCardClick }: { col: typeof COLUMNS[number]; cards: Card[]; onCardClick: (c: Card) => void }) {
  return (
    <div className="flex min-w-[260px] flex-1 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', col.color)} />
        <span className="text-sm font-semibold text-text-primary">{col.label}</span>
        <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-[10px] font-bold text-text-muted">{cards.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {cards.map((c) => <KanbanCard key={c.id} card={c} onClick={() => onCardClick(c)} />)}
      </div>
    </div>
  )
}

export default function SyncWall() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMine, setFilterMine] = useState(false)
  const [statusFilter, setStatusFilter] = useState<CardStatus | 'all'>('all')
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  useEffect(() => {
    api.get<{ cards: Card[] }>('/cards').then((d) => { setCards(d.cards); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const filtered = cards.filter((c) => {
    if (filterMine && user && !c.assignees?.some((a) => a.id === user.id) && c.creator_name !== user.name) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    return true
  })

  if (loading) {
    return (
      <div className="flex h-full gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-bg-tertiary" />
            {Array.from({ length: 3 }).map((_, j) => <div key={j} className="h-24 animate-pulse rounded-lg bg-bg-tertiary" />)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <LayoutDashboard size={20} className="text-accent" />
        <h2 className="font-heading text-lg font-bold text-text-primary">同步墙</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => setFilterMine(!filterMine)} className={cn('flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', filterMine ? 'bg-accent text-bg-primary' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary')}>
            <User size={12} /> 按我的卡片筛选
          </button>
          <button onClick={() => setStatusFilter('all')} className={cn('flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', statusFilter === 'all' ? 'bg-accent text-bg-primary' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary')}>
            <Filter size={12} /> 全部
          </button>
          {COLUMNS.map((col) => (
            <button key={col.key} onClick={() => setStatusFilter(col.key)} className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', statusFilter === col.key ? 'bg-accent text-bg-primary' : 'bg-bg-tertiary text-text-secondary hover:text-text-primary')}>
              {col.label}
            </button>
          ))}
          {user?.role === 'planner' && (
            <button onClick={() => navigate('/card/new')} className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-bg-primary transition-colors hover:bg-accent-dim">
              <Plus size={12} /> 创建卡片
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-1 gap-4 overflow-x-auto">
        {COLUMNS.map((col) => <CardColumn key={col.key} col={col} cards={filtered.filter((c) => c.status === col.key)} onCardClick={(c) => navigate(`/card/${c.id}`)} />)}
      </div>
    </div>
  )
}
