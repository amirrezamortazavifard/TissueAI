/* eslint-disable @typescript-eslint/no-explicit-any */
export enum DownloadEvent {
  onFileDownloadUpdate = 'onFileDownloadUpdate',
  onFileDownloadError = 'onFileDownloadError',
  onFileDownloadSuccess = 'onFileDownloadSuccess',
  onFileDownloadStopped = 'onFileDownloadStopped',
  onModelValidationStarted = 'onModelValidationStarted',
  onModelValidationFailed = 'onModelValidationFailed',
  onFileDownloadAndVerificationSuccess = 'onFileDownloadAndVerificationSuccess',
}

export enum AppEvent {
  onAppUpdateDownloadUpdate = 'onAppUpdateDownloadUpdate',
  onAppUpdateDownloadSuccess = 'onAppUpdateDownloadSuccess',
  onAppUpdateDownloadError = 'onAppUpdateDownloadError',
  onAppUpdateStateSync = 'onAppUpdateStateSync',
}

export interface FileDownloadState {
  modelId: string
  percent: number
  size?: { transferred: number; total: number }
  error?: string
}

type Listener = (data?: any) => void

const listeners = new Map<string, Set<Listener>>()

export const events = {
  on: (event: string, cb: Listener): (() => void) => {
    let set = listeners.get(event)
    if (!set) {
      set = new Set()
      listeners.set(event, set)
    }
    set.add(cb)
    return () => {
      events.off(event, cb)
    }
  },
  off: (event: string, cb: Listener): void => {
    const set = listeners.get(event)
    if (!set) return
    set.delete(cb)
    if (set.size === 0) listeners.delete(event)
  },
  emit: (event: string, data?: unknown): void => {
    const set = listeners.get(event)
    if (!set) return
    for (const cb of Array.from(set)) {
      try {
        cb(data)
      } catch (e) {
        console.error(`[events] listener error for ${event}`, e)
      }
    }
  },
}
