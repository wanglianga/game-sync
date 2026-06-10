import { useState, useRef } from 'react'
import {
  FileText,
  Image,
  GitCommitHorizontal,
  MessageSquare,
  Upload,
  Check,
  Reply,
  Clock,
  ExternalLink,
  Send,
  Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'

type UserRole = 'planner' | 'programmer' | 'artist'
type CommentStatus = 'open' | 'pending_confirm' | 'closed'
type AssetStatus = 'pending' | 'confirmed'

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
  status: CommentStatus
  replies?: Comment[]
  created_at: string
  updated_at: string
}

interface StatusHistory {
  id: string
  from_status: string | null
  to_status: string
  triggered_by_name?: string
  created_at: string
}

type TabKey = 'requirement' | 'assets' | 'commits' | 'comments'

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: 'requirement', label: '需求文档', icon: FileText },
  { key: 'assets', label: '美术素材', icon: Image },
  { key: 'commits', label: '代码提交', icon: GitCommitHorizontal },
  { key: 'comments', label: '评论审阅', icon: MessageSquare },
]

const STATUS_LABELS: Record<string, string> = {
  requirement: '需求',
  development: '开发中',
  review: '审阅中',
  done: '已完成',
}

const COMMENT_STATUS_COLORS: Record<CommentStatus, string> = {
  open: 'bg-[var(--warning)]/15 text-[var(--warning)]',
  pending_confirm: 'bg-[var(--purple)]/15 text-[var(--purple)]',
  closed: 'bg-[var(--success)]/15 text-[var(--success)]',
}

const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  open: '待回复',
  pending_confirm: '待确认',
  closed: '已关闭',
}

const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  pending: 'bg-[#f59e0b]/15 text-[#f59e0b]',
  confirmed: 'bg-[#22c55e]/15 text-[#22c55e]',
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

interface CardDetailTabsProps {
  cardId: string
  requirementDoc: RequirementDoc | null
  assets: Asset[]
  commits: Commit[]
  comments: Comment[]
  statusHistory: StatusHistory[]
  isPlannerOrCreator: boolean
  userRole: string
  onRefresh: () => void
}

export default function CardDetailTabs({
  cardId,
  requirementDoc,
  assets,
  commits,
  comments,
  statusHistory,
  isPlannerOrCreator,
  userRole,
  onRefresh,
}: CardDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('requirement')
  const [reqContent, setReqContent] = useState(requirementDoc?.content ?? '')
  const [savingReq, setSavingReq] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleReqBlur = async () => {
    if (reqContent === (requirementDoc?.content ?? '')) return
    setSavingReq(true)
    try {
      await api.put(`/cards/${cardId}/requirement`, { content: reqContent })
      onRefresh()
    } catch (err) {
      console.error('Failed to save requirement', err)
    } finally {
      setSavingReq(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('cardIds', JSON.stringify([cardId]))
      fd.append('description', '')
      await api.upload('/assets/upload', fd)
      onRefresh()
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirmAsset = async (assetId: string) => {
    try {
      await api.put(`/assets/${assetId}/confirm`, { cardId })
      onRefresh()
    } catch (err) {
      console.error('Confirm failed', err)
    }
  }

  const handleNewComment = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      await api.post(`/comments/${cardId}/comments`, { content: newComment.trim() })
      setNewComment('')
      onRefresh()
    } catch (err) {
      console.error('Comment failed', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = async (commentId: string) => {
    if (!replyContent.trim()) return
    setSubmitting(true)
    try {
      await api.put(`/comments/${commentId}/reply`, { content: replyContent.trim() })
      setReplyContent('')
      setReplyingTo(null)
      onRefresh()
    } catch (err) {
      console.error('Reply failed', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmComment = async (commentId: string) => {
    try {
      await api.put(`/comments/${commentId}/confirm`)
      onRefresh()
    } catch (err) {
      console.error('Confirm comment failed', err)
    }
  }

  const renderComment = (c: Comment, depth = 0) => (
    <div key={c.id} className={depth > 0 ? 'ml-8 border-l border-[var(--border)] pl-4' : ''}>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-hover)] text-xs font-bold text-[var(--text-primary)]">
            {c.author_name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)]">{c.author_name}</span>
          {c.author_role && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${ROLE_COLORS[c.author_role]}`}>
              {ROLE_LABELS[c.author_role]}
            </span>
          )}
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${COMMENT_STATUS_COLORS[c.status]}`}>
            {COMMENT_STATUS_LABELS[c.status]}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{c.content}</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">{new Date(c.created_at).toLocaleString()}</span>
          <button
            onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            <Reply size={12} /> 回复
          </button>
          {userRole === 'planner' && c.status === 'pending_confirm' && (
            <button
              onClick={() => handleConfirmComment(c.id)}
              className="flex items-center gap-1 text-xs text-[var(--purple)] transition-colors hover:text-[var(--purple-dim)]"
            >
              <Check size={12} /> 确认通过
            </button>
          )}
        </div>
        {replyingTo === c.id && (
          <div className="mt-3 flex gap-2">
            <input
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="输入回复..."
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleReply(c.id)}
            />
            <button
              onClick={() => handleReply(c.id)}
              disabled={submitting || !replyContent.trim()}
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--bg-primary)] disabled:opacity-50"
            >
              发送
            </button>
          </div>
        )}
      </div>
      {c.replies?.map((r) => renderComment(r, depth + 1))}
    </div>
  )

  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {activeTab === 'requirement' && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              {requirementDoc && (
                <span className="text-xs text-[var(--text-muted)]">
                  v{requirementDoc.version} · 更新于 {new Date(requirementDoc.updated_at).toLocaleString()}
                  {requirementDoc.updated_by_name && ` · ${requirementDoc.updated_by_name}`}
                </span>
              )}
              {savingReq && (
                <span className="flex items-center gap-1 text-xs text-[var(--accent)]">
                  <Loader2 size={12} className="animate-spin" /> 保存中
                </span>
              )}
            </div>
            {isPlannerOrCreator ? (
              <textarea
                value={reqContent}
                onChange={(e) => setReqContent(e.target.value)}
                onBlur={handleReqBlur}
                rows={16}
                className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="在此编写需求文档..."
              />
            ) : (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-4 py-3">
                {reqContent ? (
                  <pre className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{reqContent}</pre>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">暂无需求文档</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assets' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-[var(--text-secondary)]">素材列表</h3>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleUpload}
                  accept="image/*,.psd,.ai,.sketch,.blend,.fbx,.obj"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  上传素材
                </button>
              </div>
            </div>

            {assets.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">暂无关联素材</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {assets.map((a) => (
                  <div key={a.id} className="group overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]">
                    <div
                      className="relative aspect-square cursor-pointer bg-[var(--bg-secondary)]"
                      onClick={() => a.thumbnail_url && setPreviewUrl(a.url)}
                    >
                      {a.thumbnail_url ? (
                        <img src={a.thumbnail_url} alt={a.original_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Image size={32} className="text-[var(--text-muted)]" />
                        </div>
                      )}
                      <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ASSET_STATUS_COLORS[a.confirmed ? 'confirmed' : 'pending']}`}>
                        {a.confirmed ? '已确认' : '待确认'}
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs text-[var(--text-primary)]">{a.original_name}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] text-[var(--text-muted)]">{(a.size / 1024).toFixed(0)} KB</span>
                        {userRole === 'planner' && !a.confirmed && (
                          <button
                            onClick={() => handleConfirmAsset(a.id)}
                            className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:text-[var(--accent-dim)]"
                          >
                            <Check size={10} /> 确认
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {previewUrl && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreviewUrl(null)}>
                <img src={previewUrl} alt="preview" className="max-h-[90vh] max-w-[90vw] rounded-lg" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'commits' && (
          <div>
            {commits.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">暂无代码提交，由 Webhook 自动关联</p>
            ) : (
              <div className="space-y-2">
                {commits.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-4">
                    <GitCommitHorizontal size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-xs text-[var(--accent)]">
                          {c.commit_hash.slice(0, 7)}
                        </code>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--accent)]">
                            <ExternalLink size={12} />
                          </a>
                        )}
                        {c.ref && (
                          <span className="rounded-full bg-[var(--purple)]/15 px-2 py-0.5 text-[10px] text-[var(--purple)]">{c.ref}</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-primary)]">{c.message}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {c.author ?? 'Unknown'} · {new Date(c.committed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div>
            <div className="space-y-3">
              {comments.map((c) => renderComment(c))}
            </div>

            <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] p-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="添加评论..."
                rows={3}
                className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleNewComment}
                  disabled={submitting || !newComment.trim()}
                  className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] disabled:opacity-50"
                >
                  <Send size={14} /> 提交
                </button>
              </div>
            </div>

            {statusHistory.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-medium text-[var(--text-secondary)]">状态变更历史</h4>
                <div className="space-y-2">
                  {statusHistory.map((h) => (
                    <div key={h.id} className="flex items-center gap-3 text-xs">
                      <Clock size={12} className="shrink-0 text-[var(--text-muted)]" />
                      <span className="text-[var(--text-muted)]">{new Date(h.created_at).toLocaleString()}</span>
                      <span className="text-[var(--text-secondary)]">
                        {h.from_status ? STATUS_LABELS[h.from_status] ?? h.from_status : '创建'}
                        {' → '}
                        {STATUS_LABELS[h.to_status] ?? h.to_status}
                      </span>
                      {h.triggered_by_name && (
                        <span className="text-[var(--text-muted)]">by {h.triggered_by_name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
