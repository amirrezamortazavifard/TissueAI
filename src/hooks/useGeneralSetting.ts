import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { backendStorage } from '@/lib/backendStorage'

type Language = string

export const HUGGINGFACE_TOKEN_SECRET_KEY = 'huggingface'
type GeneralSettingState = {
  currentLanguage: Language
  spellCheckChatInput: boolean
  tokenCounterCompact: boolean
  autoUpdateCheck: boolean
  stripReasoningFromContext: boolean
  huggingfaceToken?: string
  setHuggingfaceToken: (token: string) => void
  setSpellCheckChatInput: (value: boolean) => void
  setTokenCounterCompact: (value: boolean) => void
  setAutoUpdateCheck: (value: boolean) => void
  setStripReasoningFromContext: (value: boolean) => void
  setCurrentLanguage: (value: Language) => void
}

export const useGeneralSetting = create<GeneralSettingState>()(
  persist(
    (set) => ({
      currentLanguage: 'en',
      spellCheckChatInput: true,
      tokenCounterCompact: true,
      autoUpdateCheck: true,
      stripReasoningFromContext: false,
      huggingfaceToken: undefined,
      setSpellCheckChatInput: (value) => set({ spellCheckChatInput: value }),
      setTokenCounterCompact: (value) => set({ tokenCounterCompact: value }),
      setAutoUpdateCheck: (value) => set({ autoUpdateCheck: value }),
      setStripReasoningFromContext: (value) =>
        set({ stripReasoningFromContext: value }),
      setCurrentLanguage: (value) => set({ currentLanguage: value }),
      setHuggingfaceToken: (token) => {
        set({ huggingfaceToken: token })
      },
    }),
    {
      name: 'tissueai-general-setting',
      storage: createJSONStorage(() => backendStorage),
      skipHydration: true,
      partialize: (state) => ({
        currentLanguage: state.currentLanguage,
        spellCheckChatInput: state.spellCheckChatInput,
        tokenCounterCompact: state.tokenCounterCompact,
        autoUpdateCheck: state.autoUpdateCheck,
        stripReasoningFromContext: state.stripReasoningFromContext,
      }),
    }
  )
)
