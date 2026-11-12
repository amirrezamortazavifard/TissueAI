import { create } from 'zustand'

const MOBILE_BREAKPOINT = 768

type MobileState = {
  isMobile: boolean
  checkMobile: () => void
}

export const useIsMobile = () => {
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  return isMobile
}

export const useMobile = create<MobileState>()((set) => ({
  isMobile: typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
  checkMobile: () => {
    if (typeof window !== 'undefined') {
      set({ isMobile: window.innerWidth < MOBILE_BREAKPOINT })
    }
  },
}))
