import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AgentWorkspaceState = {
  /** Currently selected workspace folder (absolute path). */
  folder: string | null
  setFolder: (folder: string | null) => void
  /** Whether the workspace panel is expanded in the chat. */
  panelOpen: boolean
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
}

export const useAgentWorkspace = create<AgentWorkspaceState>()(
  persist(
    (set) => ({
      folder: null,
      setFolder: (folder) => set({ folder }),
      panelOpen: false,
      openPanel: () => set({ panelOpen: true }),
      closePanel: () => set({ panelOpen: false }),
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    }),
    {
      name: 'tissueai-agent-workspace',
      // Only persist the folder path, never ephemeral panel state.
      partialize: (state) => ({ folder: state.folder }) as AgentWorkspaceState,
    }
  )
)