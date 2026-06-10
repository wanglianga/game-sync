import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Trash2, Check, FileImage, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import type { Asset, Card, AssetStatus } from '../../shared/types'

type FilterKey = 'all' | AssetStatus

const STATUS_MAP: Record<AssetStatus, { label: string; color: string }> = {
  pending: { label: '待确认', color: '#f59e0b' },
  confirmed: { label: '已确认', color: '#22c55e' },
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  planner: { label: '策划', color: 'var(--planner)' },
  programmer: { label: '程序', color: 'var(--programmer)' },
  artist: { label: '美术', color: 'var(--artist)' },
}

function formatSize(bytes: number) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`
}

export default function Assets() {
  const user = useAuthStore((s) => s.user)
  const [assets, setAssets] = useState<Asset[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [filter, setFilter] = useState<FilterKey>('all')
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [desc, setDesc] = useState('')
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const [aRes, cRes] = await Promise.all([
      api.get<{ assets: Asset[] }>('/assets'),
      api.get<{ cards: Card[] }>('/cards'),
    ])
    setAssets(aRes.assets)
    setCards(cRes.cards)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? assets : assets.filter((a) => a.status === filter)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('cardIds', JSON.stringify(selectedCardIds))
      fd.append('description', desc)
      await api.upload('/assets/upload', fd)
      setShowUpload(false)
      setFile(null)
      setDesc('')
      setSelectedCardIds([])
      load()
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async (id: string, cardId: string) => {
    await api.put(`/assets/${id}/confirm`, { cardId })
    load()
  }

  const handleDelete = async (id: string) => {
    await api.del(`/assets/${id}`)
    load()
  }

  const canConfirm = user?.role === 'planner'
  const canDelete = (uploaderId: string) => user?.role === 'planner' || user?.id === uploaderId

  const toggleCard = (cid: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(cid) ? prev.filter((c) => c !== cid) : [...prev, cid]
    )
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待确认' },
    { key: 'confirmed', label: '已确认' },
  ]

  const cardMap = new Map(cards.map((c) => [c.id, c.title]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">素材管理</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)]"
        >
          <Upload size={16} /> 上传素材
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Filter size={16} className="text-[var(--text-muted)]" />
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-[var(--accent)] text-[var(--bg-primary)]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((asset) => {
          const st = STATUS_MAP[asset.status]
          const badge = asset.uploader_name ? ROLE_BADGE[user?.role ?? ''] : null
          const isImage = asset.mime_type.startsWith('image/')
          return (
            <div key={asset.id} className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex h-32 items-center justify-center rounded-lg bg-[var(--bg-tertiary)]">
                {isImage && asset.thumbnail_url ? (
                  <img src={asset.thumbnail_url} alt={asset.original_name} className="h-full w-full rounded-lg object-cover" />
                ) : (
                  <FileImage size={40} className="text-[var(--text-muted)]" />
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]" title={asset.original_name}>
                  {asset.original_name}
                </p>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: `${st.color}20`, color: st.color }}>
                  {st.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>{formatSize(asset.size)}</span>
                <span>·</span>
                <span>{asset.uploader_name ?? 'Unknown'}</span>
                {badge && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${badge.color}20`, color: badge.color }}>
                    {badge.label}
                  </span>
                )}
                <span>·</span>
                <span>v{asset.version}</span>
              </div>
              {asset.card_ids && asset.card_ids.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {asset.card_ids.map((cid) => (
                    <span key={cid} className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                      {cardMap.get(cid) ?? cid.slice(0, 6)}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
                {canConfirm && asset.status === 'pending' && asset.card_ids?.map((cid) => (
                  <button key={cid} onClick={() => handleConfirm(asset.id, cid)} className="flex items-center gap-1 rounded-lg bg-[var(--success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--success)] transition-colors hover:bg-[var(--success)]/20">
                    <Check size={12} /> 确认
                  </button>
                ))}
                {canDelete(asset.uploaded_by) && (
                  <button onClick={() => handleDelete(asset.id)} className="flex items-center gap-1 rounded-lg bg-[var(--danger)]/10 px-2.5 py-1 text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/20">
                    <Trash2 size={12} /> 删除
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowUpload(false)}>
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-lg font-bold text-[var(--text-primary)]">上传素材</h2>
            <div
              ref={dropRef}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById('asset-file-input')?.click()}
              className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] transition-colors hover:border-[var(--accent)]"
            >
              {file ? <p className="text-sm text-[var(--text-primary)]">{file.name}</p> : <p className="text-sm text-[var(--text-muted)]">拖放文件或点击选择</p>}
              <input id="asset-file-input" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="描述（可选）"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
            <div>
              <p className="mb-2 text-sm text-[var(--text-secondary)]">关联卡片</p>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {cards.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
                    <input type="checkbox" checked={selectedCardIds.includes(c.id)} onChange={() => toggleCard(c.id)} className="accent-[var(--accent)]" />
                    <span className="truncate">{c.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-semibold text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-50"
            >
              {uploading ? '上传中…' : '上传'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
