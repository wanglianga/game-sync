import { query } from '../db.js'
import type {
  UserRole,
  WeeklyReportSnapshot,
  PlannerReportData,
  ProgrammerReportData,
  ArtistReportData,
  Card,
  Comment,
  Asset,
  Commit,
} from '../../shared/types.js'

export function getWeekRange(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date)
  const day = d.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setDate(d.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export function isSunday(date: Date = new Date()): boolean {
  return date.getDay() === 0
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function generatePlannerReport(
  teamId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<PlannerReportData> {
  const startStr = formatDate(weekStart)
  const endStr = formatDate(weekEnd) + ' 23:59:59.999'

  const [newCardsResult, pendingReviewResult, overdueCommentsResult] = await Promise.all([
    query(
      `SELECT c.*, u.name AS creator_name,
        (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) AS asset_count,
        (SELECT COUNT(*) FROM card_commits WHERE card_id = c.id) AS commit_count,
        (SELECT COUNT(*) FROM comments WHERE card_id = c.id AND status IN ('open', 'pending_confirm')) AS pending_review_count
       FROM cards c
       JOIN users u ON c.creator_id = u.id
       WHERE c.team_id = $1
         AND c.created_at >= $2::timestamp
         AND c.created_at <= $3::timestamp
       ORDER BY c.created_at DESC`,
      [teamId, startStr, endStr]
    ),
    query(
      `SELECT c.*, u.name AS creator_name,
        (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) AS asset_count,
        (SELECT COUNT(*) FROM card_commits WHERE card_id = c.id) AS commit_count,
        (SELECT COUNT(*) FROM comments WHERE card_id = c.id AND status IN ('open', 'pending_confirm')) AS pending_review_count
       FROM cards c
       JOIN users u ON c.creator_id = u.id
       WHERE c.team_id = $1
         AND c.status = 'review'
       ORDER BY c.updated_at DESC`,
      [teamId]
    ),
    query(
      `SELECT cm.*, u.name as author_name, u.role as author_role, cards.title as card_title
       FROM comments cm
       JOIN users u ON cm.author_id = u.id
       JOIN cards ON cm.card_id = cards.id
       WHERE cards.team_id = $1
         AND cm.status = 'pending_confirm'
         AND cm.updated_at < ($2::timestamp - interval '3 days')
       ORDER BY cm.updated_at ASC`,
      [teamId, endStr]
    ),
  ])

  const newCardsThisWeek = newCardsResult.rows.map((r: any) => ({
    ...r,
    asset_count: Number(r.asset_count),
    commit_count: Number(r.commit_count),
    pending_review_count: Number(r.pending_review_count),
  })) as Card[]

  const pendingReviewCards = pendingReviewResult.rows.map((r: any) => ({
    ...r,
    asset_count: Number(r.asset_count),
    commit_count: Number(r.commit_count),
    pending_review_count: Number(r.pending_review_count),
  })) as Card[]

  const overdueUnconfirmedComments = overdueCommentsResult.rows as Comment[]

  return {
    newCardsThisWeek,
    pendingReviewCards,
    overdueUnconfirmedComments,
  }
}

export async function generateProgrammerReport(
  teamId: string,
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<ProgrammerReportData> {
  const startStr = formatDate(weekStart)
  const endStr = formatDate(weekEnd) + ' 23:59:59.999'

  const weekStartTs = weekStart.getTime()
  const weekEndTs = weekEnd.getTime()

  const commitsResult = await query(
    `SELECT DISTINCT cc.card_id, c.*
     FROM card_commits cc
     JOIN commits c ON cc.commit_id = c.id
     JOIN cards ca ON cc.card_id = ca.id
     WHERE ca.team_id = $1
       AND c.committed_at >= $2::timestamp
       AND c.committed_at <= $3::timestamp
     ORDER BY c.committed_at DESC`,
    [teamId, startStr, endStr]
  )

  const cardCommitMap: Record<string, Commit[]> = {}
  for (const row of commitsResult.rows) {
    if (!cardCommitMap[row.card_id]) {
      cardCommitMap[row.card_id] = []
    }
    cardCommitMap[row.card_id].push({
      id: row.id,
      webhook_config_id: row.webhook_config_id,
      commit_hash: row.commit_hash,
      message: row.message,
      url: row.url,
      author: row.author,
      ref: row.ref,
      committed_at: row.committed_at,
    })
  }

  const prLinkedCardIds = Object.keys(cardCommitMap)
  let prLinkedCards: (Card & { commits: Commit[] })[] = []

  if (prLinkedCardIds.length > 0) {
    const cardsResult = await query(
      `SELECT c.*, u.name AS creator_name,
        (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) AS asset_count,
        (SELECT COUNT(*) FROM card_commits WHERE card_id = c.id) AS commit_count,
        (SELECT COUNT(*) FROM comments WHERE card_id = c.id AND status IN ('open', 'pending_confirm')) AS pending_review_count
       FROM cards c
       JOIN users u ON c.creator_id = u.id
       WHERE c.team_id = $1 AND c.id = ANY($2)
       ORDER BY c.updated_at DESC`,
      [teamId, prLinkedCardIds]
    )
    prLinkedCards = cardsResult.rows.map((r: any) => ({
      ...r,
      asset_count: Number(r.asset_count),
      commit_count: Number(r.commit_count),
      pending_review_count: Number(r.pending_review_count),
      commits: cardCommitMap[r.id] || [],
    }))
  }

  const returnedPRs: (Card & { commits: Commit[] })[] = prLinkedCards.filter((card) => {
    const cardRecentTs = new Date(card.updated_at).getTime()
    return card.status === 'development' && cardRecentTs >= weekStartTs && cardRecentTs <= weekEndTs
  })

  const waitingAssetsResult = await query(
    `SELECT c.*, u.name AS creator_name,
      (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) AS asset_count,
      (SELECT COUNT(*) FROM card_commits WHERE card_id = c.id) AS commit_count,
      (SELECT COUNT(*) FROM comments WHERE card_id = c.id AND status IN ('open', 'pending_confirm')) AS pending_review_count
     FROM cards c
     JOIN users u ON c.creator_id = u.id
     JOIN card_assignees ca ON ca.card_id = c.id
     WHERE c.team_id = $1
       AND ca.user_id = $2
       AND c.status IN ('requirement', 'development')
       AND (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id AND confirmed = true) = 0
       AND (SELECT COUNT(*) FROM card_commits WHERE card_id = c.id) > 0
     ORDER BY c.updated_at DESC`,
    [teamId, userId]
  )

  const waitingForAssetsCards = waitingAssetsResult.rows.map((r: any) => ({
    ...r,
    asset_count: Number(r.asset_count),
    commit_count: Number(r.commit_count),
    pending_review_count: Number(r.pending_review_count),
  })) as Card[]

  return {
    prLinkedCards,
    returnedPRs,
    waitingForAssetsCards,
  }
}

export async function generateArtistReport(
  teamId: string,
  userId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<ArtistReportData> {
  const startStr = formatDate(weekStart)
  const endStr = formatDate(weekEnd) + ' 23:59:59.999'

  const weekStartTs = weekStart.getTime()
  const weekEndTs = weekEnd.getTime()

  const assetsResult = await query(
    `SELECT a.*, ca.card_id, ca.confirmed, u.name as uploader_name
     FROM assets a
     JOIN card_assets ca ON ca.asset_id = a.id
     JOIN cards c ON ca.card_id = c.id
     WHERE a.team_id = $1
       AND a.uploaded_by = $2
     ORDER BY a.created_at DESC`,
    [teamId, userId]
  )

  const cardAssetMap: Record<string, (Asset & { confirmed: boolean })[]> = {}
  for (const row of assetsResult.rows) {
    if (!cardAssetMap[row.card_id]) {
      cardAssetMap[row.card_id] = []
    }
    cardAssetMap[row.card_id].push({
      id: row.id,
      team_id: row.team_id,
      uploaded_by: row.uploaded_by,
      uploader_name: row.uploader_name,
      filename: row.filename,
      original_name: row.original_name,
      mime_type: row.mime_type,
      size: row.size,
      url: row.url,
      thumbnail_url: row.thumbnail_url,
      version: row.version,
      status: row.status,
      description: row.description,
      created_at: row.created_at,
      confirmed: row.confirmed,
    })
  }

  const assetsReferencedCardIds = Object.keys(cardAssetMap).filter((cardId) => {
    const assets = cardAssetMap[cardId]
    return assets.some((a) => {
      const ts = new Date(a.created_at).getTime()
      return ts >= weekStartTs && ts <= weekEndTs
    })
  })

  let assetsReferencedCards: (Card & { assets: (Asset & { confirmed: boolean })[] })[] = []
  if (assetsReferencedCardIds.length > 0) {
    const cardsResult = await query(
      `SELECT c.*, u.name AS creator_name,
        (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) AS asset_count,
        (SELECT COUNT(*) FROM card_commits WHERE card_id = c.id) AS commit_count,
        (SELECT COUNT(*) FROM comments WHERE card_id = c.id AND status IN ('open', 'pending_confirm')) AS pending_review_count
       FROM cards c
       JOIN users u ON c.creator_id = u.id
       WHERE c.team_id = $1 AND c.id = ANY($2)
       ORDER BY c.updated_at DESC`,
      [teamId, assetsReferencedCardIds]
    )
    assetsReferencedCards = cardsResult.rows.map((r: any) => ({
      ...r,
      asset_count: Number(r.asset_count),
      commit_count: Number(r.commit_count),
      pending_review_count: Number(r.pending_review_count),
      assets: cardAssetMap[r.id] || [],
    }))
  }

  const pendingConfirmCardIds = Object.keys(cardAssetMap).filter((cardId) => {
    const assets = cardAssetMap[cardId]
    return assets.some((a) => !a.confirmed)
  })

  let pendingConfirmAssets: (Card & { assets: (Asset & { confirmed: boolean })[] })[] = []
  if (pendingConfirmCardIds.length > 0) {
    const cardsResult = await query(
      `SELECT c.*, u.name AS creator_name,
        (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) AS asset_count,
        (SELECT COUNT(*) FROM card_commits WHERE card_id = c.id) AS commit_count,
        (SELECT COUNT(*) FROM comments WHERE card_id = c.id AND status IN ('open', 'pending_confirm')) AS pending_review_count
       FROM cards c
       JOIN users u ON c.creator_id = u.id
       WHERE c.team_id = $1 AND c.id = ANY($2)
       ORDER BY c.updated_at DESC`,
      [teamId, pendingConfirmCardIds]
    )
    pendingConfirmAssets = cardsResult.rows.map((r: any) => ({
      ...r,
      asset_count: Number(r.asset_count),
      commit_count: Number(r.commit_count),
      pending_review_count: Number(r.pending_review_count),
      assets: (cardAssetMap[r.id] || []).filter((a) => !a.confirmed),
    }))
  }

  const changedCardsResult = await query(
    `SELECT DISTINCT c.*, u.name AS creator_name,
      (SELECT COUNT(*) FROM card_assets WHERE card_id = c.id) AS asset_count,
      (SELECT COUNT(*) FROM card_commits WHERE card_id = c.id) AS commit_count,
      (SELECT COUNT(*) FROM comments WHERE card_id = c.id AND status IN ('open', 'pending_confirm')) AS pending_review_count
     FROM cards c
     JOIN users u ON c.creator_id = u.id
     JOIN card_assets ca ON ca.card_id = c.id
     JOIN requirement_docs rd ON rd.card_id = c.id
     WHERE c.team_id = $1
       AND ca.asset_id IN (SELECT id FROM assets WHERE uploaded_by = $2)
       AND rd.updated_at >= $3::timestamp
       AND rd.updated_at <= $4::timestamp
       AND rd.version > 1
     ORDER BY c.updated_at DESC`,
    [teamId, userId, startStr, endStr]
  )

  const requirementChangedCards = changedCardsResult.rows.map((r: any) => ({
    ...r,
    asset_count: Number(r.asset_count),
    commit_count: Number(r.commit_count),
    pending_review_count: Number(r.pending_review_count),
  })) as Card[]

  return {
    assetsReferencedCards,
    pendingConfirmAssets,
    requirementChangedCards,
  }
}

export async function generateWeeklyReport(
  teamId: string,
  userId: string,
  role: UserRole,
  weekStart?: Date,
  weekEnd?: Date
): Promise<WeeklyReportSnapshot> {
  const { start, end } = getWeekRange(weekStart || new Date())
  const ws = weekStart || start
  const we = weekEnd || end

  const snapshot: WeeklyReportSnapshot = {
    generated_at: new Date().toISOString(),
    week_start: formatDate(ws),
    week_end: formatDate(we),
  }

  switch (role) {
    case 'planner':
      snapshot.planner = await generatePlannerReport(teamId, ws, we)
      break
    case 'programmer':
      snapshot.programmer = await generateProgrammerReport(teamId, userId, ws, we)
      break
    case 'artist':
      snapshot.artist = await generateArtistReport(teamId, userId, ws, we)
      break
  }

  return snapshot
}

export async function saveWeeklyReport(
  teamId: string,
  userId: string,
  role: UserRole,
  snapshot: WeeklyReportSnapshot
): Promise<any> {
  const result = await query(
    `INSERT INTO weekly_reports (team_id, user_id, role, week_start, week_end, snapshot)
     VALUES ($1, $2, $3, $4::date, $5::date, $6)
     ON CONFLICT (team_id, user_id, week_start, week_end)
     DO UPDATE SET snapshot = $6, updated_at = NOW()
     RETURNING *`,
    [teamId, userId, role, snapshot.week_start, snapshot.week_end, JSON.stringify(snapshot)]
  )
  return result.rows[0]
}

export async function getLatestWeeklyReport(teamId: string, userId: string): Promise<any | null> {
  const result = await query(
    `SELECT * FROM weekly_reports
     WHERE team_id = $1 AND user_id = $2
     ORDER BY week_end DESC
     LIMIT 1`,
    [teamId, userId]
  )
  return result.rows.length > 0 ? result.rows[0] : null
}

export async function getAllTeamWeeklyReports(teamId: string, weekStart?: string, weekEnd?: string): Promise<any[]> {
  let sql = `SELECT wr.*, u.name as user_name FROM weekly_reports wr
             JOIN users u ON wr.user_id = u.id
             WHERE wr.team_id = $1`
  const params: unknown[] = [teamId]
  let idx = 2

  if (weekStart) {
    sql += ` AND wr.week_start = $${idx++}::date`
    params.push(weekStart)
  }
  if (weekEnd) {
    sql += ` AND wr.week_end = $${idx++}::date`
    params.push(weekEnd)
  }

  sql += ` ORDER BY wr.week_end DESC, wr.role, u.name`

  const result = await query(sql, params)
  return result.rows
}

export function generateMarkdownReport(
  role: UserRole,
  snapshot: WeeklyReportSnapshot,
  userName: string
): string {
  const lines: string[] = []
  lines.push(`# 周报快照 - ${userName}`)
  lines.push('')
  lines.push(`> 周期：${snapshot.week_start} 至 ${snapshot.week_end}`)
  lines.push(`> 生成时间：${snapshot.generated_at}`)
  lines.push(`> 角色：${roleLabel(role)}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  switch (role) {
    case 'planner':
      lines.push(renderPlannerMarkdown(snapshot))
      break
    case 'programmer':
      lines.push(renderProgrammerMarkdown(snapshot))
      break
    case 'artist':
      lines.push(renderArtistMarkdown(snapshot))
      break
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(`*本报告由系统自动生成，可手动触发重新生成。*`)

  return lines.join('\n')
}

function roleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    planner: '策划',
    programmer: '程序',
    artist: '美术',
  }
  return map[role]
}

function renderPlannerMarkdown(snapshot: WeeklyReportSnapshot): string {
  const data = snapshot.planner
  if (!data) return '无数据'
  const lines: string[] = []

  lines.push('## 一、本周新增卡片')
  lines.push('')
  if (data.newCardsThisWeek.length === 0) {
    lines.push('_本周暂无新增卡片_')
  } else {
    lines.push(`共 **${data.newCardsThisWeek.length}** 张新卡片：`)
    lines.push('')
    lines.push('| 卡片ID | 标题 | 优先级 | 状态 | 创建人 | 创建时间 |')
    lines.push('|--------|------|--------|------|--------|----------|')
    for (const card of data.newCardsThisWeek) {
      lines.push(
        `| ${shortId(card.id)} | ${escapeMd(card.title)} | ${priorityLabel(card.priority)} | ${statusLabel(card.status)} | ${escapeMd(card.creator_name || '-')} | ${formatDateTime(card.created_at)} |`
      )
    }
  }
  lines.push('')

  lines.push('## 二、待验收卡片')
  lines.push('')
  if (data.pendingReviewCards.length === 0) {
    lines.push('_暂无待验收卡片_')
  } else {
    lines.push(`共 **${data.pendingReviewCards.length}** 张卡片等待验收：`)
    lines.push('')
    lines.push('| 卡片ID | 标题 | 进度 | 优先级 | 创建人 | 更新时间 |')
    lines.push('|--------|------|------|--------|--------|----------|')
    for (const card of data.pendingReviewCards) {
      lines.push(
        `| ${shortId(card.id)} | ${escapeMd(card.title)} | ${card.progress}% | ${priorityLabel(card.priority)} | ${escapeMd(card.creator_name || '-')} | ${formatDateTime(card.updated_at)} |`
      )
    }
  }
  lines.push('')

  lines.push('## 三、逾期未确认评论')
  lines.push('')
  if (data.overdueUnconfirmedComments.length === 0) {
    lines.push('_暂无逾期未确认评论_')
  } else {
    lines.push(`共 **${data.overdueUnconfirmedComments.length}** 条评论逾期超过3天未确认：`)
    lines.push('')
    lines.push('| 评论ID | 所属卡片 | 作者 | 内容摘要 | 状态 | 更新时间 |')
    lines.push('|--------|----------|------|----------|------|----------|')
    for (const c of data.overdueUnconfirmedComments) {
      lines.push(
        `| ${shortId(c.id)} | ${escapeMd((c as any).card_title || '-')} | ${escapeMd(c.author_name || '-')} | ${escapeMd(truncate(c.content, 40))} | ${commentStatusLabel(c.status)} | ${formatDateTime(c.updated_at)} |`
      )
    }
  }

  return lines.join('\n')
}

function renderProgrammerMarkdown(snapshot: WeeklyReportSnapshot): string {
  const data = snapshot.programmer
  if (!data) return '无数据'
  const lines: string[] = []

  lines.push('## 一、本周提交PR关联的卡片')
  lines.push('')
  if (data.prLinkedCards.length === 0) {
    lines.push('_本周暂无提交PR_')
  } else {
    lines.push(`本周提交共关联 **${data.prLinkedCards.length}** 张卡片：`)
    lines.push('')
    for (const card of data.prLinkedCards) {
      lines.push(`### ${escapeMd(card.title)} (${shortId(card.id)})`)
      lines.push(`- 状态：${statusLabel(card.status)}，进度：${card.progress}%`)
      lines.push(`- 关联提交（${card.commits.length} 次）：`)
      for (const commit of card.commits.slice(0, 5)) {
        lines.push(`  - \`${shortHash(commit.commit_hash)}\` ${escapeMd(truncate(commit.message, 60))} - ${commit.author || '未知'} (${formatDateTime(commit.committed_at)})`)
      }
      if (card.commits.length > 5) {
        lines.push(`  - ...共 ${card.commits.length} 次提交`)
      }
      lines.push('')
    }
  }

  lines.push('## 二、被退回的PR/卡片')
  lines.push('')
  if (data.returnedPRs.length === 0) {
    lines.push('_本周无被退回的卡片_')
  } else {
    lines.push(`共 **${data.returnedPRs.length}** 张卡片被退回重新开发：`)
    lines.push('')
    lines.push('| 卡片ID | 标题 | 当前进度 | 优先级 | 更新时间 |')
    lines.push('|--------|------|----------|--------|----------|')
    for (const card of data.returnedPRs) {
      lines.push(
        `| ${shortId(card.id)} | ${escapeMd(card.title)} | ${card.progress}% | ${priorityLabel(card.priority)} | ${formatDateTime(card.updated_at)} |`
      )
    }
  }
  lines.push('')

  lines.push('## 三、等待素材的卡片')
  lines.push('')
  if (data.waitingForAssetsCards.length === 0) {
    lines.push('_暂无等待素材的卡片_')
  } else {
    lines.push(`共 **${data.waitingForAssetsCards.length}** 张卡片代码已提交但素材未就绪：`)
    lines.push('')
    lines.push('| 卡片ID | 标题 | 状态 | 提交次数 | 优先级 | 更新时间 |')
    lines.push('|--------|------|------|----------|--------|----------|')
    for (const card of data.waitingForAssetsCards) {
      lines.push(
        `| ${shortId(card.id)} | ${escapeMd(card.title)} | ${statusLabel(card.status)} | ${card.commit_count || 0} | ${priorityLabel(card.priority)} | ${formatDateTime(card.updated_at)} |`
      )
    }
  }

  return lines.join('\n')
}

function renderArtistMarkdown(snapshot: WeeklyReportSnapshot): string {
  const data = snapshot.artist
  if (!data) return '无数据'
  const lines: string[] = []

  lines.push('## 一、本周被引用素材的卡片')
  lines.push('')
  if (data.assetsReferencedCards.length === 0) {
    lines.push('_本周暂无素材被引用_')
  } else {
    const totalAssets = data.assetsReferencedCards.reduce((sum, c) => sum + c.assets.length, 0)
    lines.push(`本周共上传/引用 **${totalAssets}** 个素材，涉及 **${data.assetsReferencedCards.length}** 张卡片：`)
    lines.push('')
    for (const card of data.assetsReferencedCards) {
      lines.push(`### ${escapeMd(card.title)} (${shortId(card.id)})`)
      lines.push(`- 状态：${statusLabel(card.status)}，进度：${card.progress}%`)
      lines.push(`- 引用素材（${card.assets.length} 个）：`)
      for (const asset of card.assets) {
        const confirmedTag = (asset as any).confirmed ? '✅ 已确认' : '⏳ 待确认'
        lines.push(`  - ${escapeMd(asset.original_name)} (${(asset.size / 1024).toFixed(1)}KB) - ${confirmedTag}`)
      }
      lines.push('')
    }
  }

  lines.push('## 二、待确认素材的卡片')
  lines.push('')
  if (data.pendingConfirmAssets.length === 0) {
    lines.push('_暂无待确认的素材_')
  } else {
    const pendingCount = data.pendingConfirmAssets.reduce((sum, c) => sum + c.assets.length, 0)
    lines.push(`共 **${pendingCount}** 个素材等待确认，涉及 **${data.pendingConfirmAssets.length}** 张卡片：`)
    lines.push('')
    for (const card of data.pendingConfirmAssets) {
      lines.push(`### ${escapeMd(card.title)} (${shortId(card.id)})`)
      lines.push(`- 待确认素材（${card.assets.length} 个）：`)
      for (const asset of card.assets) {
        lines.push(`  - ${escapeMd(asset.original_name)} (${(asset.size / 1024).toFixed(1)}KB) - 上传于 ${formatDateTime(asset.created_at)}`)
      }
      lines.push('')
    }
  }

  lines.push('## 三、需求变更的卡片')
  lines.push('')
  if (data.requirementChangedCards.length === 0) {
    lines.push('_本周涉及素材的卡片无需求变更_')
  } else {
    lines.push(`共 **${data.requirementChangedCards.length}** 张卡片的需求文档发生变更：`)
    lines.push('')
    lines.push('| 卡片ID | 标题 | 当前状态 | 进度 | 优先级 | 更新时间 |')
    lines.push('|--------|------|----------|------|--------|----------|')
    for (const card of data.requirementChangedCards) {
      lines.push(
        `| ${shortId(card.id)} | ${escapeMd(card.title)} | ${statusLabel(card.status)} | ${card.progress}% | ${priorityLabel(card.priority)} | ${formatDateTime(card.updated_at)} |`
      )
    }
  }

  return lines.join('\n')
}

function shortId(id: string): string {
  return id.substring(0, 8)
}

function shortHash(hash: string): string {
  return hash.substring(0, 7)
}

function escapeMd(s: string): string {
  return (s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function truncate(s: string, len: number): string {
  if (!s) return ''
  return s.length > len ? s.substring(0, len) + '...' : s
}

function formatDateTime(s: string): string {
  if (!s) return '-'
  const d = new Date(s)
  return d.toISOString().replace('T', ' ').substring(0, 16)
}

function priorityLabel(p: string): string {
  const map: Record<string, string> = { low: '低', medium: '中', high: '高' }
  return map[p] || p
}

function statusLabel(s: string): string {
  const map: Record<string, string> = { requirement: '需求', development: '开发中', review: '验收', done: '完成' }
  return map[s] || s
}

function commentStatusLabel(s: string): string {
  const map: Record<string, string> = { open: '开放', pending_confirm: '待确认', closed: '已关闭' }
  return map[s] || s
}

export async function generateAllTeamReports(teamId: string, weekStart?: Date, weekEnd?: Date): Promise<any[]> {
  const membersResult = await query(
    `SELECT tm.user_id, u.role, u.name
     FROM team_members tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.team_id = $1`,
    [teamId]
  )

  const savedReports: any[] = []
  for (const member of membersResult.rows) {
    const snapshot = await generateWeeklyReport(teamId, member.user_id, member.role, weekStart, weekEnd)
    const saved = await saveWeeklyReport(teamId, member.user_id, member.role, snapshot)
    savedReports.push({ ...saved, user_name: member.name })
  }

  return savedReports
}
