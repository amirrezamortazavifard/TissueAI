import { useEffect } from 'react'
import { getServiceHub } from '@/hooks/useServiceHub'
import { useThreads } from '@/hooks/useThreads'
import { useMessages } from '@/hooks/useMessages'
import { syncProvidersWithBackend } from '@/lib/providerSync'

/**
 * One-shot startup hydration: seeds the Jan-style provider store from the
 * backend, loads persisted threads into the useThreads store, and hydrates
 * saved thread messages into useMessages store so history is available immediately.
 */
export function useChatHydration() {
  useEffect(() => {
    try {
      syncProvidersWithBackend();
    } catch {
      // non-critical
    }
    const serviceHub = getServiceHub();
    serviceHub
      .threads()
      .getThreads()
      .then(async (list) => {
        useThreads.getState().setThreads(list || []);
        useThreads.getState().setThreadsLoading(false);

        // Pre-fetch messages for all stored threads so history displays reliably
        if (Array.isArray(list)) {
          for (const thread of list) {
            try {
              const msgs = await serviceHub.messages().fetchMessages(thread.id);
              if (msgs && msgs.length > 0) {
                useMessages.getState().setMessages(thread.id, msgs);
              }
            } catch (e) {
              console.warn(`[Hydration] Failed to fetch messages for thread ${thread.id}:`, e);
            }
          }
        }
      })
      .catch(() => {
        useThreads.getState().setThreadsLoading(false);
      });
  }, []);
}
