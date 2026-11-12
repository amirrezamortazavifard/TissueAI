import { create } from "zustand";
import { ChatMessage, ChatSession, ChatSettings, defaultChatSettings } from "../components/tools/Chat/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New Chat";
  return firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "..." : "");
}

interface ChatStore {
  sessions: ChatSession[];
  activeSessionId: string | null;
  settings: ChatSettings;
  isStreaming: boolean;
  sidebarOpen: boolean;

  createSession: () => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  getActiveSession: () => ChatSession | null;

  addUserMessage: (content: string) => string;
  addAssistantMessage: (content: string, model?: string) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearSession: (id: string) => void;

  setSettings: (settings: Partial<ChatSettings>) => void;
  setStreaming: (v: boolean) => void;
  toggleSidebar: () => void;
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem("tissueai_chat_sessions");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem("tissueai_chat_sessions", JSON.stringify(sessions));
}

function loadSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem("tissueai_chat_settings");
    return raw ? { ...defaultChatSettings, ...JSON.parse(raw) } : defaultChatSettings;
  } catch {
    return defaultChatSettings;
  }
}

function saveSettings(settings: ChatSettings) {
  localStorage.setItem("tissueai_chat_settings", JSON.stringify(settings));
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: loadSessions(),
  activeSessionId: null,
  settings: loadSettings(),
  isStreaming: false,
  sidebarOpen: true,

  createSession: () => {
    const id = generateId();
    const session: ChatSession = {
      id,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const sessions = [session, ...get().sessions];
    saveSessions(sessions);
    set({ sessions, activeSessionId: id });
    return id;
  },

  deleteSession: (id) => {
    const sessions = get().sessions.filter((s) => s.id !== id);
    saveSessions(sessions);
    const activeSessionId = get().activeSessionId === id ? (sessions[0]?.id ?? null) : get().activeSessionId;
    set({ sessions, activeSessionId });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },

  addUserMessage: (content) => {
    const msgId = generateId();
    let { sessions, activeSessionId } = get();

    if (!activeSessionId) {
      const id = get().createSession();
      activeSessionId = id;
      sessions = get().sessions;
    }

    sessions = sessions.map((s) => {
      if (s.id !== activeSessionId) return s;
      const msg: ChatMessage = { id: msgId, role: "user", content, timestamp: Date.now() };
      const messages = [...s.messages, msg];
      return { ...s, messages, title: generateTitle(messages), updatedAt: Date.now() };
    });
    saveSessions(sessions);
    set({ sessions });
    return msgId;
  },

  addAssistantMessage: (content, model) => {
    const msgId = generateId();
    const { sessions, activeSessionId } = get();
    if (!activeSessionId) return;

    const updated = sessions.map((s) => {
      if (s.id !== activeSessionId) return s;
      const msg: ChatMessage = { id: msgId, role: "assistant", content, timestamp: Date.now(), model };
      return { ...s, messages: [...s.messages, msg], updatedAt: Date.now() };
    });
    saveSessions(updated);
    set({ sessions: updated });
  },

  updateLastAssistantMessage: (content) => {
    const { sessions, activeSessionId } = get();
    if (!activeSessionId) return;

    const updated = sessions.map((s) => {
      if (s.id !== activeSessionId) return s;
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], content };
          break;
        }
      }
      return { ...s, messages: msgs, updatedAt: Date.now() };
    });
    saveSessions(updated);
    set({ sessions: updated });
  },

  clearSession: (id) => {
    const sessions = get().sessions.map((s) =>
      s.id === id ? { ...s, messages: [], title: "New Chat", updatedAt: Date.now() } : s
    );
    saveSessions(sessions);
    set({ sessions });
  },

  setSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    saveSettings(settings);
    set({ settings });
  },

  setStreaming: (v) => set({ isStreaming: v }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
}));
