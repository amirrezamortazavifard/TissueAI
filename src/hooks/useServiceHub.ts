import { create } from 'zustand'
import type { ServiceHub } from '@/types'
import { defaultServiceHub } from '@/lib/serviceHub'

interface ServiceState {
  serviceHub: ServiceHub | null
  setServiceHub: (serviceHub: ServiceHub) => void
}

export const useServiceStore = create<ServiceState>()((set) => ({
  serviceHub: null,
  setServiceHub: (serviceHub) => set({ serviceHub }),
}))

export const useServiceHub = (): ServiceHub => {
  const serviceHub = useServiceStore((state) => state.serviceHub)
  if (!serviceHub) {
    console.warn('[ServiceHub] Using default - no backend connected')
    return defaultServiceHub
  }
  return serviceHub
}

export const getServiceHub = (): ServiceHub => {
  const serviceHub = useServiceStore.getState().serviceHub
  if (!serviceHub) {
    return defaultServiceHub
  }
  return serviceHub
}

export const initializeServiceHubStore = (serviceHub: ServiceHub) => {
  useServiceStore.getState().setServiceHub(serviceHub)
}
