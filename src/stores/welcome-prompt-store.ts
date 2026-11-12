import { create } from 'zustand'

type WelcomePromptState = {
  prompt: string
  setPrompt: (prompt: string) => void
}

export const useWelcomePrompt = create<WelcomePromptState>((set) => ({
  prompt: '',
  setPrompt: (prompt) => set({ prompt }),
}))
