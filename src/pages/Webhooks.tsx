import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Eye, EyeOff, Copy, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import type { WebhookConfig, WebhookEvent } from '../../shared/types'

export default function Webhooks() {
  const [configs, setConfigs] = useState<WebhookConfig[]>([])
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [newSecret, setNewSecret] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const [cRes, eRes] = await Promise.all([
      api.get<WebhookConfig[]>('/webhooks/config'),
      api.get<{ events: WebhookEvent[] }>('/webhooks/events'),
    ])
    setConfigs(cRes)
    setEvents(eRes.events)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!repoUrl.trim()) return
    setCreating(true)
    try {
      const result = await api.post<{ secret: string }>('/webhooks/config', { repoUrl })
      setNewSecret(result.secret)
      setRepoUrl('')
      load()
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    await api.del(`/webhooks/config/${id}`)
    load()
  }

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const maskSecret = (s: string) => s.slice(0, 4) + '••••••••' + s.slice(-4)

  const copySecret = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (d: string) => new Date(d).toLocaleString('zh-CN')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">Webhook 集成</h1>
        <button
          onClick={() => { setShowAdd(true); setNewSecret('') }}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)]"
        >
          <Plus size={16} /> 添加仓库
        </button>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">配置列表</h2>
        {configs.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">暂无 Webhook 配置，点击上方按钮添加</p>
        )}
        <div className="space-y-3">
          {configs.map((cfg) => (
            <div key={cfg.id} className="glass-card flex items-center justify-between rounded-xl px-5 py-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{cfg.repo_url}</p>
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span>Secret:</span>
                  <code className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 font-mono">
                    {revealed.has(cfg.id) ? cfg.secret : maskSecret(cfg.secret)}
                  </code>
                  <button onClick={() => toggleReveal(cfg.id)} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                    {revealed.has(cfg.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => copySecret(cfg.secret)} className="text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]">
                    <Copy size={14} />
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)]">创建于 {formatDate(cfg.created_at)}</p>
              </div>
              <button onClick={() => handleDelete(cfg.id)} className="ml-4 flex items-center gap-1 rounded-lg bg-[var(--danger)]/10 px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/20">
                <Trash2 size={14} /> 删除
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">事件日志</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">事件类型</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">时间</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">关联卡片</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-[var(--text-muted)]">暂无事件</td></tr>
              )}
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--accent)]">{ev.event_type}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">{formatDate(ev.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {ev.linked_card_ids.length > 0
                        ? ev.linked_card_ids.map((cid) => (
                            <span key={cid} className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
                              {cid.slice(0, 6)}
                            </span>
                          ))
                        : <span className="text-[var(--text-muted)]">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleExpand(ev.id)} className="flex items-center gap-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                      {expanded.has(ev.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="text-xs">预览</span>
                    </button>
                    {expanded.has(ev.id) && (
                      <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[var(--bg-tertiary)] p-3 text-xs text-[var(--text-secondary)]">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-lg font-bold text-[var(--text-primary)]">添加仓库</h2>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="仓库 URL（如 https://github.com/owner/repo）"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleCreate}
              disabled={!repoUrl.trim() || creating}
              className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-50"
            >
              {creating ? '创建中…' : '添加'}
            </button>
            {newSecret && (
              <div className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 p-4 space-y-2">
                <p className="text-sm font-medium text-[var(--success)]">Webhook 已创建！请保存以下 Secret</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-[var(--bg-tertiary)] px-2 py-1 font-mono text-xs text-[var(--text-primary)]">{newSecret}</code>
                  <button onClick={() => copySecret(newSecret)} className="shrink-0 rounded-lg bg-[var(--success)]/10 px-2.5 py-1.5 text-xs font-medium text-[var(--success)] hover:bg-[var(--success)]/20">
                    <Copy size={14} />
                  </button>
                </div>
                {copied && <p className="text-xs text-[var(--success)]">已复制到剪贴板</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
