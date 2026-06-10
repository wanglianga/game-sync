export type UserRole = 'planner' | 'programmer' | 'artist'
export type CardStatus = 'requirement' | 'development' | 'review' | 'done'
export type Priority = 'low' | 'medium' | 'high'
export type CommentStatus = 'open' | 'pending_confirm' | 'closed'
export type AssetStatus = 'pending' | 'confirmed'
export type NotificationType = 'card_status_changed' | 'asset_uploaded' | 'comment_added' | 'comment_confirmed' | 'pr_linked'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
}

export interface Team {
  id: string
  name: string
  invite_code: string
  creator_id: string | null
  created_at: string
}

export interface Card {
  id: string
  team_id: string
  creator_id: string
  title: string
  description: string
  status: CardStatus
  progress: number
  priority: Priority
  creator_name?: string
  creator_role?: UserRole
  assignees?: Assignee[]
  asset_count?: number
  commit_count?: number
  pending_review_count?: number
  created_at: string
  updated_at: string
}

export interface Assignee {
  id: string
  name: string
  role: UserRole
}

export interface RequirementDoc {
  id: string
  card_id: string
  content: string
  version: number
  updated_by: string
  updated_by_name?: string
  updated_at: string
}

export interface Asset {
  id: string
  team_id: string
  uploaded_by: string
  uploader_name?: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  url: string
  thumbnail_url: string | null
  version: number
  status: AssetStatus
  description: string
  card_ids?: string[]
  created_at: string
}

export interface CardAsset {
  id: string
  card_id: string
  asset_id: string
  confirmed: boolean
  asset?: Asset
}

export interface WebhookConfig {
  id: string
  team_id: string
  created_by: string
  repo_url: string
  secret: string
  created_at: string
}

export interface WebhookEvent {
  id: string
  config_id: string
  event_type: string
  payload: Record<string, unknown>
  linked_card_ids: string[]
  created_at: string
}

export interface Commit {
  id: string
  webhook_config_id: string
  commit_hash: string
  message: string
  url: string | null
  author: string | null
  ref: string | null
  committed_at: string
}

export interface Comment {
  id: string
  card_id: string
  author_id: string
  author_name?: string
  author_role?: UserRole
  parent_id: string | null
  content: string
  status: CommentStatus
  replies?: Comment[]
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  team_id: string
  type: NotificationType
  title: string
  message: string
  card_id: string | null
  read: boolean
  created_at: string
}

export interface StatusHistory {
  id: string
  card_id: string
  from_status: CardStatus | null
  to_status: CardStatus
  reason: string
  triggered_by: string
  triggered_by_name?: string
  created_at: string
}
