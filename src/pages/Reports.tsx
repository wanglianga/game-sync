import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Download, RefreshCw, FileText, Users, ChevronRight, Loader2 } from 'lucide-react'
import type { WeeklyReport, UserRole } from '../../shared/types'

const ROLE_LABELS: Record<UserRole, string> = {
  planner: '策划',
  programmer: '程序',
  artist: '美术',
}

const ROLE_COLORS: Record<UserRole, string> = {
  planner: 'bg-[var(--planner)] text-white',
  programmer: 'bg-[var(--programmer)] text-white',
  artist: 'bg-[var(--artist)] text-white',
}

interface TeamReport extends WeeklyReport {
  user_name: string
}

export default function Reports() {
  const user = useAuthStore((s) => s.user)
  const [myReport, setMyReport] = useState<WeeklyReport | null>(null)
  const [teamReports, setTeamReports] = useState<TeamReport[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null)
  const [markdownPreview, setMarkdownPreview] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadReports()
  }, [])

  async function loadReports() {
    try {
      setLoading(true)
      setError('')
      const [myRes, teamRes] = await Promise.all([
        api.get<{ success: boolean; data: WeeklyReport }>('/reports/weekly/me').catch(() => ({ success: false, data: null })),
        api.get<{ success: boolean; data: TeamReport[] }>('/reports/weekly/team'),
      ])
      if (myRes && myRes.success) setMyReport(myRes.data)
      if (teamRes.success) setTeamReports(teamRes.data)
    } catch (err: any) {
      setError(err.message || '加载周报失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateMine() {
    try {
      setGenerating(true)
      setError('')
      const res = await api.post<{ success: boolean; data: WeeklyReport }>('/reports/weekly/generate')
      if (res.success) {
        setMyReport(res.data)
        await loadReports()
      }
    } catch (err: any) {
      setError(err.message || '生成周报失败')
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateAll() {
    try {
      setGenerating(true)
      setError('')
      const res = await api.post<{ success: boolean; data: TeamReport[] }>('/reports/weekly/generate-all')
      if (res.success) {
        await loadReports()
      }
    } catch (err: any) {
      setError(err.message || '生成团队周报失败')
    } finally {
      setGenerating(false)
    }
  }

  async function handlePreview(report: WeeklyReport) {
    try {
      setSelectedReport(report)
      setPreviewLoading(true)
      const res = await api.get<{ success: boolean; data: { markdown: string } }>(`/reports/weekly/${report.id}/preview`)
      if (res.success) {
        setMarkdownPreview(res.data.markdown)
      }
    } catch (err: any) {
      setError(err.message || '预览失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  function handleExport(report: WeeklyReport) {
    const token = localStorage.getItem('token')
    const url = `/api/reports/weekly/${report.id}/export`
    const a = document.createElement('a')
    a.href = url
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.blob())
        .then((blob) => {
          a.href = URL.createObjectURL(blob)
          a.download = `weekly-report-${report.role}-${report.week_start}.md`
          a.click()
        })
        .catch(() => {
          window.open(url, '_blank')
        })
    } else {
      a.target = '_blank'
      a.click()
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold text-[var(--text-primary)]">周报快照</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">每周日自动生成差异化周报，支持手动触发和Markdown导出</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateMine}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            重新生成我的周报
          </button>
          {user?.role === 'planner' && (
            <button
              onClick={handleGenerateAll}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-50"
            >
              <Users className="h-4 w-4" />
              生成全团队周报
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
          <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-[var(--text-primary)]">
            <FileText className="h-5 w-5 text-[var(--accent)]" />
            我的周报
          </h3>
          {myReport ? (
            <ReportCard
              report={myReport}
              userName={user?.name || ''}
              onPreview={() => handlePreview(myReport)}
              onExport={() => handleExport(myReport)}
              isSelected={selectedReport?.id === myReport.id}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)]">暂无周报快照</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">每周日自动生成，或点击上方按钮手动生成</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
          <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-[var(--text-primary)]">
            <Users className="h-5 w-5 text-[var(--accent)]" />
            团队周报
            <span className="ml-2 rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
              {teamReports.length}
            </span>
          </h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {teamReports.length > 0 ? (
              teamReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  userName={report.user_name}
                  onPreview={() => handlePreview(report)}
                  onExport={() => handleExport(report)}
                  isSelected={selectedReport?.id === report.id}
                />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
                <p className="text-sm text-[var(--text-muted)]">暂无团队周报</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedReport && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-heading text-lg font-semibold text-[var(--text-primary)]">
              <FileText className="h-5 w-5 text-[var(--accent)]" />
              Markdown 预览
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[selectedReport.role as UserRole]}`}>
                {ROLE_LABELS[selectedReport.role as UserRole]}
              </span>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport(selectedReport)}
                className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)]"
              >
                <Download className="h-4 w-4" />
                导出MD
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-[var(--bg-primary)] p-4">
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-[var(--text-secondary)]">
                {markdownPreview || '点击"预览"查看Markdown内容'}
              </pre>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function ReportCard({
  report,
  userName,
  onPreview,
  onExport,
  isSelected,
}: {
  report: WeeklyReport
  userName: string
  onPreview: () => void
  onExport: () => void
  isSelected: boolean
}) {
  const data = report.snapshot
  const role = report.role as UserRole

  let statItems: { label: string; count: number }[] = []
  if (role === 'planner' && data.planner) {
    statItems = [
      { label: '新增卡片', count: data.planner.newCardsThisWeek.length },
      { label: '待验收', count: data.planner.pendingReviewCards.length },
      { label: '逾期评论', count: data.planner.overdueUnconfirmedComments.length },
    ]
  } else if (role === 'programmer' && data.programmer) {
    statItems = [
      { label: 'PR关联卡片', count: data.programmer.prLinkedCards.length },
      { label: '被退回', count: data.programmer.returnedPRs.length },
      { label: '等素材', count: data.programmer.waitingForAssetsCards.length },
    ]
  } else if (role === 'artist' && data.artist) {
    statItems = [
      { label: '素材引用', count: data.artist.assetsReferencedCards.length },
      { label: '待确认素材', count: data.artist.pendingConfirmAssets.length },
      { label: '需求变更', count: data.artist.requirementChangedCards.length },
    ]
  }

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isSelected
          ? 'border-[var(--accent)] bg-[var(--accent)]/5'
          : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--accent)]/50'
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-sm font-bold text-[var(--text-primary)]">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-primary)]">{userName}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[role]}`}>
                {ROLE_LABELS[role]}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {report.week_start} ~ {report.week_end}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onPreview}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ChevronRight className="h-3.5 w-3.5" />
            预览
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Download className="h-3.5 w-3.5" />
            导出
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="rounded-md bg-[var(--bg-secondary)] px-2 py-1.5 text-center"
          >
            <p className="text-lg font-bold text-[var(--accent)]">{item.count}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
