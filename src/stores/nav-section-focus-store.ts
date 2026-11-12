import { create } from 'zustand'

export type NavSection = 'chats' | 'projects' | null

type NavSectionFocusState = {
  section: NavSection
  focus: (section: 'chats' | 'projects') => void
}

let clearTimer: ReturnType<typeof setTimeout> | null = null

export const useNavSectionFocus = create<NavSectionFocusState>((set) => ({
  section: null,
  focus: (section) => {
    set({ section })
    if (clearTimer) clearTimeout(clearTimer)
    clearTimer = setTimeout(() => set({ section: null }), 2000)
  },
}))
