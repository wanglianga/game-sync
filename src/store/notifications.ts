import { create } from 'zustand';

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  ws: WebSocket | null;
  unreadCount: number;
  connectWS: (token: string) => void;
  disconnectWS: () => void;
  addNotification: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  ws: null,
  unreadCount: 0,
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
          get().addNotification(data.payload);
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
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.read ? 0 : 1),
    }));
  },
  markRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },
  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },
}));
