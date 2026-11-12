import { create } from 'zustand'

type ThemeState = {
  theme: 'light' | 'dark' | 'system'
  isDark: boolean
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useTheme = create<ThemeState>()((set) => ({
  theme: 'system',
  isDark: false,
  setTheme: (theme) => {
    const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    set({ theme, isDark })
  },
}))
