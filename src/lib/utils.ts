import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistanceToNow(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return '刚刚'
  }
  if (diffMins < 60) {
    return `${diffMins}分钟前`
  }
  if (diffHours < 24) {
    return `${diffHours}小时前`
  }
  if (diffDays < 7) {
    return `${diffDays}天前`
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks}周前`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months}个月前`
  }
  const years = Math.floor(diffDays / 365)
  return `${years}年前`
}
