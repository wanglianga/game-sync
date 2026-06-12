import { create } from 'zustand';
import { api } from '@/lib/api';

export interface NotificationItem {
  id: string;
  user_id: string;
  team_id: string;
  type: string;
  title: string;
  message: string;
  card_id: string | null;
  read: boolean;
  created_at: string;
  is_overdue?: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  ws: WebSocket | null;
  unreadCount: number;
  total: number;
  loading: boolean;
  connectWS: (token: string) => void;
  disconnectWS: () => void;
  fetchNotifications: () => Promise<void>;
  addNotification: (notification: NotificationItem) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  requestNotificationPermission: () => Promise<boolean>;
  showBrowserNotification: (title: string, body: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  card_status_changed: '状态变更',
  asset_uploaded: '素材上传',
  comment_added: '评论回复',
  comment_confirmed: '评论确认',
  pr_linked: '代码提交',
  weekly_report_generated: '周报生成',
  overdue_reminder: '漏掉预警',
};

export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  ws: null,
  unreadCount: 0,
  total: 0,
  loading: false,

  requestNotificationPermission: async () => {
    if (!('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission === 'denied') {
      return false;
    }
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  showBrowserNotification: (title, body) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
      });
    } catch {
      // ignore notification errors
    }
  },

  connectWS: (token) => {
    const existing = get().ws;
    if (existing) {
      existing.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'notification') {
          const notification = data.payload as NotificationItem;
          get().addNotification(notification);
          if (!notification.read) {
            get().showBrowserNotification(
              notification.title,
              notification.message
            );
          }
        } else if (data.type === 'overdue') {
          get().fetchNotifications();
        } else if (data.type === 'read' || data.type === 'read_all') {
          get().fetchNotifications();
        } else if (data.id && data.type === undefined) {
          const notification = data as NotificationItem;
          if (notification.type) {
            get().addNotification(notification);
            if (!notification.read) {
              get().showBrowserNotification(
                notification.title,
                notification.message
              );
            }
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      set({ ws: null });
    };

    set({ ws });
  },

  disconnectWS: () => {
    const ws = get().ws;
    if (ws) {
      ws.close();
    }
    set({ ws: null });
  },

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const res = await api.get<any>('/notifications?limit=100');
      if (res.success) {
        set({
          notifications: res.data.notifications,
          unreadCount: res.data.unread,
          total: res.data.total,
        });
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      set({ loading: false });
    }
  },

  addNotification: (notification) => {
    set((state) => {
      const exists = state.notifications.some((n) => n.id === notification.id);
      if (exists) {
        return state;
      }
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.read ? 0 : 1),
        total: state.total + 1,
      };
    });
  },

  markRead: async (id) => {
    try {
      const res = await api.put<any>(`/notifications/${id}/read`);
      if (res.success) {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true, is_overdue: false } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  },

  markAllRead: async () => {
    try {
      const res = await api.put<any>('/notifications/read-all');
      if (res.success) {
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            read: true,
            is_overdue: false,
          })),
          unreadCount: 0,
        }));
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  },
}));
