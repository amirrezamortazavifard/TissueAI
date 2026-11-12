import {
  Folder,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { useThreads } from '@/hooks/useThreads'
import { useIsThreadActive } from '@/hooks/useAppState'
import { useChatSessions } from '@/stores/chat-session-store'
import { useMessages } from '@/hooks/useMessages'
import { useThreadManagement } from '@/hooks/useThreadManagement'
import { useServiceHub } from '@/hooks/useServiceHub'
import { useEffect, useRef } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { memo, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RenameThreadDialog, DeleteThreadDialog } from '@/containers/dialogs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDate, formatRelativeTime } from '@/utils/formatDate'
import type { Thread } from '@/types/core'
import type { ThreadMessage } from '@/types/core'

const ThreadItem = memo(
  ({
    thread,
    isMobile,
    currentProjectId,
  }: {
    thread: Thread
    isMobile: boolean
    currentProjectId?: string
  }) => {
    const deleteThread = useThreads((state) => state.deleteThread)
    const renameThread = useThreads((state) => state.renameThread)
    const updateThread = useThreads((state) => state.updateThread)
    const getFolderById = useThreadManagement().getFolderById
    const { folders } = useThreadManagement()
    const { t } = useTranslation()
    const [renameOpen, setRenameOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

    const serviceHub = useServiceHub()
    const getMessages = useMessages((state) => state.getMessages)
    const setMessages = useMessages((state) => state.setMessages)

    const messagesLoadedRef = useRef(false)
    const messagesLengthRef = useRef(0)

    const [messages, setLocalMessages] = useState<ThreadMessage[]>(() =>
      getMessages(thread.id)
    )

    useEffect(() => {
      const currentMessages = getMessages(thread.id)

      if (currentMessages.length === 0 && !messagesLoadedRef.current) {
        messagesLoadedRef.current = true
        serviceHub
          .messages()
          .fetchMessages(thread.id)
          .then((fetchedMessages) => {
            if (fetchedMessages && fetchedMessages.length > 0) {
              setMessages(thread.id, fetchedMessages)
              setLocalMessages(fetchedMessages)
              messagesLengthRef.current = fetchedMessages.length
            }
          })
          .catch(() => {
            messagesLoadedRef.current = false
          })
        return
      }

      if (currentMessages.length !== messagesLengthRef.current) {
        setLocalMessages(currentMessages)
        messagesLengthRef.current = currentMessages.length
      }
    }, [thread.id, serviceHub, getMessages, setMessages])

    const lastUserMessageText = useMemo(() => {
      const userMessages = messages.filter((m) => m.role === 'user')
      const lastUserMessage = userMessages[userMessages.length - 1]
      if (!lastUserMessage) return undefined
      const textContent = lastUserMessage.content?.find(
        (c) => c.type === 'text'
      )
      return textContent?.text?.value
    }, [messages])

    const plainTitleForRename = useMemo(() => {
      return (thread.title || '').replace(/<span[^>]*>|<\/span>/g, '')
    }, [thread.title])

    const availableProjects = useMemo(() => {
      return folders
        .filter((f) => {
          if (f.id === currentProjectId) return false
          if (f.id === thread.metadata?.project?.id) return false
          return true
        })
        .sort((a, b) => b.updated_at - a.updated_at)
    }, [folders, currentProjectId, thread.metadata?.project?.id])

    const assignThreadToProject = (threadId: string, projectId: string) => {
      const project = getFolderById(projectId)
      if (project && updateThread) {
        const projectMetadata = {
          id: project.id,
          name: project.name,
          updated_at: project.updated_at,
        }

        updateThread(threadId, {
          metadata: {
            ...thread.metadata,
            project: projectMetadata,
          },
        })

        toast.success(`Thread assigned to "${project.name}" successfully`)
      }
    }

    const isAppStateActive = useIsThreadActive(thread.id)
    const isSessionStreaming = useChatSessions(
      (state) => state.sessions[thread.id]?.isStreaming ?? false
    )
    const isActive = isAppStateActive || isSessionStreaming

    const params = useParams()
    const currentThreadId = params.threadId
    const isSelected = currentThreadId === thread.id

    return (
      <SidebarMenuItem>
        {currentProjectId ? (
          <Link
            to={`/llm/chat/${thread.id}`}
            className={cn(
              'bg-card dark:bg-secondary/20 mb-2 px-4 py-4 border hover:dark:bg-secondary/30 rounded-lg block max-w-full overflow-hidden',
              isSelected && 'border-primary'
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {isActive && (
                <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
              )}
              <span
                className={cn(
                  'block truncate',
                  isSelected && 'font-medium text-primary'
                )}
                title={thread.title || t('common:newThread')}
              >
                {thread.title || t('common:newThread')}
              </span>
            </div>
            {currentProjectId && lastUserMessageText && (
              <div className="text-muted-foreground text-xs mt-1 line-clamp-1 pr-10">
                {lastUserMessageText}
              </div>
            )}
          </Link>
        ) : (
          <Link
            to={`/llm/chat/${thread.id}`}
            className={cn(
              'nav-thread-row mb-1 flex items-start gap-2.5 rounded-xl px-2.5 py-2',
              isSelected && 'nav-thread-row-active'
            )}
          >
            {isActive ? (
              <Loader2 className="mt-1 size-3.5 shrink-0 animate-spin text-primary" />
            ) : (
              <span
                className={cn(
                  'nav-thread-icon flex size-6 shrink-0 items-center justify-center rounded-lg'
                )}
              >
                <MessageCircle className="size-3.5" strokeWidth={2} />
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'block truncate text-[13px]',
                    isSelected && 'font-medium text-primary'
                  )}
                  title={thread.title || t('common:newThread')}
                >
                  {thread.title || t('common:newThread')}
                </span>
                <time
                  className="nav-thread-time shrink-0"
                  title={formatDate(thread.updated, { includeTime: false })}
                >
                  {formatRelativeTime(thread.updated)}
                </time>
              </span>
              {lastUserMessageText && (
                <span className="nav-thread-preview line-clamp-1">
                  {lastUserMessageText}
                </span>
              )}
              {thread.metadata?.project?.name && !isSelected && (
                <span className="nav-thread-meta">
                  {thread.metadata.project.name}
                </span>
              )}
            </span>
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              className={cn(
                'hover:bg-sidebar-foreground/[0.08] transition-colors duration-200',
                currentProjectId && 'mt-4 mr-2'
              )}
            >
              <MoreHorizontal />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-48"
            side={isMobile ? 'bottom' : 'right'}
            align={isMobile ? 'end' : 'start'}
          >
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil className="size-4" />
              <span>{t('common:rename')}</span>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <Folder className="size-4" />
                <span>{t('common:projects.addToProject')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-60 min-w-44 overflow-y-auto">
                {availableProjects.length === 0 ? (
                  <DropdownMenuItem disabled>
                    <span className="text-muted-foreground">
                      {t('common:projects.noProjectsAvailable')}
                    </span>
                  </DropdownMenuItem>
                ) : (
                  availableProjects.map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        assignThreadToProject(thread.id, folder.id)
                      }}
                    >
                      <Folder className="size-4" />
                      <span className="truncate max-w-[200px]">
                        {folder.name}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {thread.metadata?.project && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    const projectName = thread.metadata?.project?.name
                    updateThread(thread.id, {
                      metadata: {
                        ...thread.metadata,
                        project: undefined,
                      },
                    })
                    toast.success(
                      `Thread removed from "${projectName}" successfully`
                    )
                  }}
                >
                  <X className="size-4" />
                  <span>Remove from project</span>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={
                thread.title === 'What is Jan?' &&
                !localStorage.getItem('setup-completed')
              }
              onSelect={() => {
                if (
                  thread.title !== 'What is Jan?' ||
                  localStorage.getItem('setup-completed')
                ) {
                  setDeleteConfirmOpen(true)
                }
              }}
            >
              <Trash2 className="size-4" />
              <span>{t('common:delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <RenameThreadDialog
          thread={thread}
          plainTitleForRename={plainTitleForRename}
          onRename={renameThread}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          withoutTrigger
        />

        <DeleteThreadDialog
          thread={thread}
          onDelete={deleteThread}
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          withoutTrigger
        />
      </SidebarMenuItem>
    )
  }
)

type HistoryBucket =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'lastMonth'
  | 'older'

const BUCKET_LABELS: Record<HistoryBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Previous 7 Days',
  lastMonth: 'Previous Month',
  older: 'Older',
}

const BUCKET_ORDER: HistoryBucket[] = [
  'today',
  'yesterday',
  'last7',
  'lastMonth',
  'older',
]

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function bucketFor(timestamp: number): HistoryBucket {
  const now = Date.now()
  const diffDays = Math.floor(
    (startOfDay(now) - startOfDay(timestamp)) / 86400000
  )
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays <= 7) return 'last7'
  if (diffDays <= 30) return 'lastMonth'
  return 'older'
}

type HistoryGroup = {
  label: string
  threads: Thread[]
}

type ThreadListProps = {
  threads: Thread[]
  currentProjectId?: string
}

function ThreadList({ threads, currentProjectId }: ThreadListProps) {
  const { isMobile } = useSidebar()

  const grouped = useMemo(() => {
    const sorted = [...threads].sort(
      (a, b) => (b.updated || 0) - (a.updated || 0)
    )
    const buckets = new Map<HistoryBucket, Thread[]>()
    for (const b of BUCKET_ORDER) buckets.set(b, [])
    for (const t of sorted) {
      const bucket = bucketFor(t.updated || Date.now())
      buckets.get(bucket)?.push(t)
    }
    return BUCKET_ORDER.filter(
      (b) => (buckets.get(b)?.length ?? 0) > 0
    ).map<HistoryGroup>((b) => ({
      label: BUCKET_LABELS[b],
      threads: buckets.get(b)!,
    }))
  }, [threads])

  return (
    <>
      {grouped.map((group) => (
        <div key={group.label} className="nav-history-group">
          <div className="nav-history-group-label">{group.label}</div>
          <div className="flex flex-col">
            {group.threads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                isMobile={isMobile}
                currentProjectId={currentProjectId}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

export default memo(ThreadList)
