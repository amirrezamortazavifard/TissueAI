import { useState, useCallback, useEffect } from 'react'
import { events } from '@/lib/app-events'

export interface UpdateInfo {
  version: string
  notes?: string
  pub_date?: string
}

export interface UpdateState {
  isUpdateAvailable: boolean
  updateInfo: UpdateInfo | null
  isDownloading: boolean
  downloadProgress: number
  downloadedBytes: number
  totalBytes: number
  remindMeLater: boolean
}

export const useAppUpdater = () => {
  const [updateState, setUpdateState] = useState<UpdateState>({
    isUpdateAvailable: false,
    updateInfo: null,
    isDownloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    remindMeLater: false,
  })

  useEffect(() => {
    const handleUpdateStateSync = (newState?: unknown) => {
      setUpdateState((prev) => ({
        ...prev,
        ...(newState as Partial<UpdateState>),
      }))
    }

    events.on('onAppUpdateStateSync', handleUpdateStateSync)

    return () => {
      events.off('onAppUpdateStateSync', handleUpdateStateSync)
    }
  }, [])

  const syncStateToOtherInstances = useCallback(
    (partialState: Partial<UpdateState>) => {
      events.emit('onAppUpdateStateSync', partialState)
    },
    []
  )

  const checkForUpdate = useCallback(
    async (_resetRemindMeLater = false): Promise<boolean> => {
      return false
    },
    []
  )

  const downloadUpdate = useCallback(async (): Promise<void> => {}, [])

  const installUpdate = useCallback(async (): Promise<void> => {}, [])

  const remindMeLater = useCallback((): void => {}, [])

  return {
    updateState,
    syncStateToOtherInstances,
    checkForUpdate,
    downloadUpdate,
    installUpdate,
    remindMeLater,
  }
}
