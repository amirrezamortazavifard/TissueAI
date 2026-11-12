import { create } from 'zustand'
import { ulid } from 'ulidx'
import { getServiceHub } from '@/hooks/useServiceHub'
import { Fzf } from 'fzf'
import { TEMPORARY_CHAT_ID } from '@/constants/chat'
import { useAgentMode } from '@/hooks/useAgentMode'
import { ExtensionManager } from '@/lib/extension'
import { ExtensionTypeEnum, VectorDBExtension, type ModelInfo, type Thread as CoreThread } from '@/types/core'
import { useChatSessions } from '@/stores/chat-session-store'
import { useAppState } from '@/hooks/useAppState'
import type { Assistant } from '@/types'

type ThreadModel = {
  id: string
  provider?: string
}

type ThreadAssistantInfo = {
  id: string
  name: string
  model?: ThreadModel
  instructions?: string
  parameters?: Record<string, unknown>
}

type Thread = {
  id: string
  title: string
  model?: ThreadModel
  assistants?: ThreadAssistantInfo[]
  updated?: number
  isFavorite?: boolean
  metadata?: {
    project?: { id: string; name: string; updated_at: number }
    isTemporary?: boolean
    titleSetManually?: boolean
    [key: string]: unknown
  }
}

type ThreadState = {
  threads: Record<string, Thread>
  isLoadingThreads: boolean
  setThreadsLoading: (loading: boolean) => void
  currentThreadId?: string
  getCurrentThread: () => Thread | undefined
  setThreads: (threads: Thread[]) => void
  getFavoriteThreads: () => Thread[]
  getThreadById: (threadId: string) => Thread | undefined
  toggleFavorite: (threadId: string) => void
  deleteThread: (threadId: string) => void
  renameThread: (threadId: string, newTitle: string) => void
  deleteAllThreads: () => void
  clearAllThreads: () => void
  unstarAllThreads: () => void
  setCurrentThreadId: (threadId?: string) => void
  createThread: (
    model: ThreadModel,
    title?: string,
    assistant?: Assistant,
    projectMetadata?: { id: string; name: string; updated_at: number },
    isTemporary?: boolean
  ) => Promise<Thread>
  updateCurrentThreadModel: (model: ThreadModel) => void
  getFilteredThreads: (searchTerm: string) => Thread[]
  updateCurrentThreadAssistant: (assistant: Assistant) => void
  updateThreadTimestamp: (threadId: string) => void
  updateThread: (threadId: string, updates: Partial<Thread>) => void
  deleteAllThreadsByProject: (projectId: string) => void
  searchIndex: Fzf<Thread[]> | null
}

const cleanupVectorDB = async (threadId: string) => {
  try {
    const vec = ExtensionManager.getInstance().get<VectorDBExtension>(
      ExtensionTypeEnum.VectorDB
    )
    if (vec?.deleteCollection) {
      await vec.deleteCollection(`attachments_${threadId}`)
    }
  } catch (e) {
    console.warn(
      `[Threads] Failed to delete vector DB collection for thread ${threadId}:`,
      e
    )
  }
}

export const useThreads = create<ThreadState>()((set, get) => ({
  threads: {},
  isLoadingThreads: true,
  setThreadsLoading: (loading) => set({ isLoadingThreads: loading }),
  searchIndex: null,
  setThreads: (threads) => {
    const threadMap = threads.reduce(
      (acc: Record<string, Thread>, thread) => {
        acc[thread.id] = {
          ...thread,
          model: thread.model
            ? {
                provider:
                  thread.model?.provider?.replace('llama.cpp', 'llamacpp') ??
                  'llamacpp',
                id:
                  thread.model?.provider === 'llama.cpp' ||
                  thread.model?.provider === 'llamacpp'
                    ? thread.model?.id
                        ?.split(':')
                        .slice(0, 2)
                        .join(getServiceHub().path().sep())
                    : thread.model?.id,
              }
            : undefined,
        }
        return acc
      },
      {} as Record<string, Thread>
    )
    const filteredForSearch = Object.values(threadMap).filter(
      (t) => t.id !== TEMPORARY_CHAT_ID && t.title
    )

    set({
      threads: threadMap,
      searchIndex: new Fzf<Thread[]>(filteredForSearch, {
        selector: (item: Thread) => item.title ?? '',
      }),
    })
  },
  getFilteredThreads: (searchTerm: string) => {
    const { threads, searchIndex } = get()

    const filteredThreadsValues = Object.values(threads).filter(
      (t) => t.id !== TEMPORARY_CHAT_ID
    )

    if (!searchTerm) {
      return filteredThreadsValues
    }

    let currentIndex = searchIndex
    if (!currentIndex?.find) {
      currentIndex = new Fzf<Thread[]>(filteredThreadsValues.filter(t => t.title), {
        selector: (item: Thread) => item.title ?? '',
      })
      set({ searchIndex: currentIndex })
    }

    const fzfResults = currentIndex!.find(searchTerm)
    return fzfResults.map(
      (result: { item: Thread; positions: Set<number> }) => {
        const thread = result.item
        return {
          ...thread,
          title: thread.title,
        }
      }
    )
  },
  toggleFavorite: (threadId) => {
    set((state) => {
      getServiceHub()
        .threads()
        .updateThread(
          state.threads[threadId].id,
          { isFavorite: !state.threads[threadId].isFavorite }
        )
      return {
        threads: {
          ...state.threads,
          [threadId]: {
            ...state.threads[threadId],
            isFavorite: !state.threads[threadId].isFavorite,
            updated: Date.now() / 1000,
          },
        },
      }
    })
  },
  deleteThread: (threadId) => {
    set((state) => {
      const { [threadId]: _, ...remainingThreads } = state.threads

      useAgentMode.getState().removeThread(threadId)
      useChatSessions.getState().removeSession(threadId)
      useAppState.getState().clearThreadState(threadId)
      cleanupVectorDB(threadId)
      getServiceHub().threads().deleteThread(threadId)

      return {
        threads: remainingThreads,
        searchIndex: new Fzf<Thread[]>(
          Object.values(remainingThreads).filter(
            (t) => t.id !== TEMPORARY_CHAT_ID && t.title
          ),
          {
            selector: (item: Thread) => item.title ?? '',
          }
        ),
      }
    })
  },
  deleteAllThreads: () => {
    set((state) => {
      const allThreadIds = Object.keys(state.threads)

      const threadsToKeepIds = allThreadIds.filter(
        (threadId) =>
          state.threads[threadId].isFavorite ||
          state.threads[threadId].metadata?.project
      )

      const threadsToDeleteIds = allThreadIds.filter(
        (threadId) =>
          !state.threads[threadId].isFavorite &&
          !state.threads[threadId].metadata?.project
      )

      threadsToDeleteIds.forEach((threadId) => {
        cleanupVectorDB(threadId)
        getServiceHub().threads().deleteThread(threadId)
      })

      const remainingThreads = threadsToKeepIds.reduce(
        (acc, threadId) => {
          acc[threadId] = state.threads[threadId]
          return acc
        },
        {} as Record<string, Thread>
      )

      return {
        threads: remainingThreads,
        searchIndex: new Fzf<Thread[]>(
          Object.values(remainingThreads).filter(
            (t) => t.id !== TEMPORARY_CHAT_ID && t.title
          ),
          {
            selector: (item: Thread) => item.title ?? '',
          }
        ),
      }
    })
  },
  clearAllThreads: () => {
    set((state) => {
      const allThreadIds = Object.keys(state.threads)

      allThreadIds.forEach((threadId) => {
        useAgentMode.getState().removeThread(threadId)
        useChatSessions.getState().removeSession(threadId)
        useAppState.getState().clearThreadState(threadId)
        cleanupVectorDB(threadId)
        getServiceHub().threads().deleteThread(threadId)
      })

      return {
        threads: {},
        currentThreadId: undefined,
        searchIndex: new Fzf<Thread[]>([], {
          selector: (item: Thread) => item.title ?? '',
        }),
      }
    })
  },
  deleteAllThreadsByProject: (projectId) => {
    set((state) => {
      const allThreadIds = Object.keys(state.threads)

      const threadsToDeleteIds = allThreadIds.filter(
        (threadId) =>
          state.threads[threadId].metadata?.project?.id === projectId
      )

      threadsToDeleteIds.forEach((threadId) => {
        useChatSessions.getState().removeSession(threadId)
        useAppState.getState().clearThreadState(threadId)
        cleanupVectorDB(threadId)
        getServiceHub().threads().deleteThread(threadId)
      })

      const remainingThreads = allThreadIds
        .filter((threadId) => !threadsToDeleteIds.includes(threadId))
        .reduce(
          (acc, threadId) => {
            acc[threadId] = state.threads[threadId]
            return acc
          },
          {} as Record<string, Thread>
        )

      return {
        threads: remainingThreads,
        searchIndex: new Fzf<Thread[]>(Object.values(remainingThreads).filter(t => t.id !== TEMPORARY_CHAT_ID && t.title), {
          selector: (item: Thread) => item.title ?? '',
        }),
      }
    })
  },
  unstarAllThreads: () => {
    set((state) => {
      const updatedThreads = Object.keys(state.threads).reduce(
        (acc, threadId) => {
          acc[threadId] = {
            ...state.threads[threadId],
            isFavorite: false,
          }
          return acc
        },
        {} as Record<string, Thread>
      )
      Object.values(updatedThreads).forEach((thread) => {
        getServiceHub()
          .threads()
          .updateThread(thread.id, { isFavorite: false })
      })
      return { threads: updatedThreads }
    })
  },
  getFavoriteThreads: () => {
    return Object.values(get().threads).filter((thread) => thread.isFavorite)
  },
  getThreadById: (threadId: string) => {
    return get().threads[threadId]
  },
  setCurrentThreadId: (threadId) => {
    if (threadId !== get().currentThreadId) set({ currentThreadId: threadId })
  },
  createThread: async (
    model,
    title,
    assistant,
    projectMetadata,
    isTemporary
  ) => {
    const newThread: Thread = {
      id: isTemporary ? TEMPORARY_CHAT_ID : ulid(),
      title: title ?? (isTemporary ? 'Temporary Chat' : 'New Thread'),
      model,
      updated: Date.now() / 1000,
      assistants: assistant ? [assistant] : [],
      ...(projectMetadata &&
        !isTemporary && {
          metadata: {
            project: projectMetadata,
          },
        }),
      ...(isTemporary && {
        metadata: {
          isTemporary: true,
          ...(projectMetadata && { project: projectMetadata }),
        },
      }),
    }
    return await getServiceHub()
      .threads()
      .createThread(newThread.id, newThread.title, newThread.assistants?.[0], projectMetadata)
      .then((createdThread: Thread) => {
        const existingThreads = Object.values(get().threads)
        const reorderedThreads = [createdThread, ...existingThreads]
        const threadMap = reorderedThreads.reduce(
          (acc: Record<string, Thread>, thread) => {
            acc[thread.id] = {
              ...thread,
              model: thread.model
                ? {
                    provider:
                      thread.model?.provider?.replace('llama.cpp', 'llamacpp') ??
                      'llamacpp',
                    id:
                      thread.model?.provider === 'llama.cpp' ||
                      thread.model?.provider === 'llamacpp'
                        ? thread.model?.id
                            ?.split(':')
                            .slice(0, 2)
                            .join(getServiceHub().path().sep())
                        : thread.model?.id,
                  }
                : undefined,
            }
            return acc
          },
          {} as Record<string, Thread>
        )
        const filteredForSearch = Object.values(threadMap).filter(
          (t) => t.id !== TEMPORARY_CHAT_ID && t.title
        )
        set({
          threads: threadMap,
          currentThreadId: createdThread.id,
          searchIndex: new Fzf<Thread[]>(filteredForSearch, {
            selector: (item: Thread) => item.title ?? '',
          }),
        })
        return createdThread
      })
  },
  updateCurrentThreadAssistant: (assistant) => {
    set((state) => {
      if (!state.currentThreadId) return { ...state }
      const currentThread = state.getCurrentThread()
      if (currentThread)
        getServiceHub()
          .threads()
          .updateThread(
            currentThread.id,
            { assistants: assistant ? [{ ...assistant, model: currentThread.model as ModelInfo }] : [] }
          )
      return {
        threads: {
          ...state.threads,
          [state.currentThreadId as string]: {
            ...state.threads[state.currentThreadId as string],
            assistants: assistant
              ? [{ ...assistant, model: currentThread?.model }]
              : [],
            updated: Date.now() / 1000,
          },
        },
      }
    })
  },
  updateCurrentThreadModel: (model) => {
    set((state) => {
      if (!state.currentThreadId) return { ...state }
      const currentThread = state.getCurrentThread()
      if (currentThread)
        getServiceHub()
          .threads()
          .updateThread(currentThread.id, { model: model as { id: string; provider: string } })
      return {
        threads: {
          ...state.threads,
          [state.currentThreadId as string]: {
            ...state.threads[state.currentThreadId as string],
            model,
          },
        },
      }
    })
  },
  renameThread: (threadId, newTitle) => {
    set((state) => {
      const thread = state.threads[threadId]
      if (!thread) return state
      const updatedThread = {
        ...thread,
        title: newTitle,
        updated: Date.now() / 1000,
        metadata: { ...thread.metadata, titleSetManually: true },
      }
      getServiceHub().threads().updateThread(threadId, { title: newTitle })
      const newThreads = { ...state.threads, [threadId]: updatedThread }
      return {
        threads: newThreads,
        searchIndex: new Fzf<Thread[]>(
          Object.values(newThreads).filter((t) => t.id !== TEMPORARY_CHAT_ID && t.title),
          {
            selector: (item: Thread) => item.title ?? '',
          }
        ),
      }
    })
  },
  getCurrentThread: () => {
    const { currentThreadId, threads } = get()
    return currentThreadId ? threads[currentThreadId] : undefined
  },
  updateThreadTimestamp: (threadId) => {
    set((state) => {
      const thread = state.threads[threadId]
      if (!thread) return state

      const updatedThread = {
        ...thread,
        updated: Date.now() / 1000,
      }

      const updatedThreads = { ...state.threads }
      updatedThreads[threadId] = updatedThread

      getServiceHub().threads().updateThread(threadId, { updated: updatedThread.updated })

      return {
        threads: updatedThreads,
        searchIndex: new Fzf<Thread[]>(
          Object.values(updatedThreads).filter(
            (t) => t.id !== TEMPORARY_CHAT_ID && t.title
          ),
          {
            selector: (item: Thread) => item.title ?? '',
          }
        ),
      }
    })
  },
  updateThread: (threadId, updates) => {
    set((state) => {
      const thread = state.threads[threadId]
      if (!thread) return state

      const updatedThread = {
        ...thread,
        ...updates,
        updated: Date.now() / 1000,
      }

      getServiceHub().threads().updateThread(threadId, updates as Partial<CoreThread>)

      const newThreads = { ...state.threads, [threadId]: updatedThread }
      return {
        threads: newThreads,
        searchIndex: new Fzf<Thread[]>(
          Object.values(newThreads).filter((t) => t.id !== TEMPORARY_CHAT_ID && t.title),
          {
            selector: (item: Thread) => item.title ?? '',
          }
        ),
      }
    })
  },
}))
