import { create } from 'zustand'

interface AssistantSwitcherState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  cycleHandler: (() => void) | null
  setCycleHandler: (fn: (() => void) | null) => void
}

export const useAssistantSwitcher = create<AssistantSwitcherState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  cycleHandler: null,
  setCycleHandler: (fn) => set({ cycleHandler: fn }),
}))
