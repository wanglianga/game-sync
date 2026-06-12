import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  RefreshCw,
  Code,
  Image,
  MessageSquare,
  FileBarChart,
  ArrowRight,
} from 'lucide-react';
import { useNotificationStore, getTypeLabel } from '@/store/notifications';
import { formatDistanceToNow } from '@/lib/utils';

const TYPE_ICONS: Record<string, typeof Bell> = {
  card_status_changed: ArrowRight,
  asset_uploaded: Image,
  comment_added: MessageSquare,
  comment_confirmed: CheckCheck,
  pr_linked: Code,
  weekly_report_generated: FileBarChart,
  overdue_reminder: AlertTriangle,
};

const TYPE_COLORS: Record<string, string> = {
  card_status_changed: 'text-blue-500 bg-blue-500/10',
  asset_uploaded: 'text-purple-500 bg-purple-500/10',
  comment_added: 'text-green-500 bg-green-500/10',
  comment_confirmed: 'text-emerald-500 bg-emerald-500/10',
  pr_linked: 'text-orange-500 bg-orange-500/10',
  weekly_report_generated: 'text-indigo-500 bg-indigo-500/10',
  overdue_reminder: 'text-red-500 bg-red-500/10',
};

export default function Notifications() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    requestNotificationPermission,
  } = useNotificationStore();

  const [filter, setFilter] = useState<'all' | 'unread' | 'overdue'>('all');
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    fetchNotifications();
    if ('Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted');
    }
  }, [fetchNotifications]);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
  };

  const handleMarkRead = async (id: string, cardId?: string | null) => {
    await markRead(id);
    if (cardId) {
      navigate(`/card/${cardId}`);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'overdue') return n.is_overdue;
    return true;
  });

  const overdueCount = notifications.filter((n) => n.is_overdue).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            信息流聚合
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            所有消息按时间倒序排列，及时掌握项目动态
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!permissionGranted && (
            <button
              onClick={handleEnableNotifications}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <Bell size={16} />
              开启浏览器通知
            </button>
          )}
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--bg-primary)] transition-colors hover:bg-[var(--accent-dim)] disabled:opacity-50"
          >
            <CheckCheck size={16} />
            全部已读
          </button>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle size={20} className="text-red-500" />
          <div className="flex-1">
            <p className="font-medium text-red-600 dark:text-red-400">
              漏掉预警
            </p>
            <p className="text-sm text-red-500/80">
              您有 {overdueCount} 条消息超过48小时未读，请及时处理
            </p>
          </div>
          <button
            onClick={() => setFilter('overdue')}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
          >
            查看全部
          </button>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {(['all', 'unread', 'overdue'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[var(--accent)] text-[var(--bg-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            {f === 'all' && `全部 (${notifications.length})`}
            {f === 'unread' && `未读 (${unreadCount})`}
            {f === 'overdue' && `逾期 (${overdueCount})`}
          </button>
        ))}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-[var(--text-muted)]" />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bell size={48} className="mb-4 text-[var(--text-muted)]" />
          <p className="text-lg font-medium text-[var(--text-secondary)]">
            暂无消息
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {filter === 'unread'
              ? '所有消息都已阅读'
              : filter === 'overdue'
              ? '没有逾期未读的消息'
              : '新消息会出现在这里'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const Icon = TYPE_ICONS[notification.type] || Bell;
            const iconColor = TYPE_COLORS[notification.type] || 'text-[var(--accent)] bg-[var(--accent)]/10';

            return (
              <div
                key={notification.id}
                onClick={() => handleMarkRead(notification.id, notification.card_id)}
                className={`group relative cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md ${
                  notification.is_overdue
                    ? 'border-red-500/30 bg-red-500/5'
                    : notification.read
                    ? 'border-[var(--border)] bg-[var(--bg-secondary)]'
                    : 'border-[var(--accent)]/30 bg-[var(--accent)]/5'
                }`}
              >
                {!notification.read && (
                  <div className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                )}
                {notification.is_overdue && (
                  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    <AlertTriangle size={10} />
                    逾期
                  </div>
                )}

                <div className="flex gap-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${iconColor}`}
                  >
                    <Icon size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                        {getTypeLabel(notification.type)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Clock size={12} />
                        {formatDistanceToNow(notification.created_at)}
                      </span>
                    </div>

                    <h3
                      className={`mt-1.5 text-sm font-semibold ${
                        notification.read
                          ? 'text-[var(--text-secondary)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {notification.title}
                    </h3>

                    <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
                      {notification.message}
                    </p>

                    {notification.card_id && (
                      <div className="mt-2 flex items-center text-xs text-[var(--text-muted)]">
                        <span className="group-hover:text-[var(--accent)]">
                          点击查看详情 →
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
