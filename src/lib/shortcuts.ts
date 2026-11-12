/**
 * Shortcuts - Centralized keyboard shortcut system
 *
 * Provides platform-aware keyboard shortcuts that avoid browser conflicts
 * on web while maintaining familiar shortcuts on desktop.
 */

/** Runtime platform detection for shortcuts. */
export const isMac =
  typeof navigator !== 'undefined' &&
  navigator.userAgent.toUpperCase().indexOf('MAC') >= 0

export enum ShortcutAction {
  NEW_CHAT = 'newChat',
  NEW_AGENT_CHAT = 'newAgentChat',
  NEW_PROJECT = 'newProject',
  TOGGLE_SIDEBAR = 'toggleSidebar',
  GO_TO_SETTINGS = 'goSettings',
  SEARCH = 'search',
  SWITCH_ASSISTANT = 'switchAssistant',
  ZOOM_IN = 'zoomIn',
  ZOOM_OUT = 'zoomOut',
}

export interface ShortcutSpec {
  key: string
  // Extra KeyboardEvent.key values that trigger the same action, for keys whose
  // emitted value depends on layout or shift state (e.g. '+' arrives as '=').
  aliasKeys?: string[]
  usePlatformMetaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}

export type ShortcutMap = Record<ShortcutAction, ShortcutSpec>

/**
 * Platform-specific shortcut mappings
 * Uses alternate bindings for web to avoid browser conflicts
 */
export const PlatformShortcuts: ShortcutMap = {
  // Toggle sidebar - same on both platforms (no browser conflict)
  [ShortcutAction.TOGGLE_SIDEBAR]: {
    key: 'b',
    usePlatformMetaKey: true,
  },

  // New chat - different per platform to avoid browser "new window" conflict
  [ShortcutAction.NEW_CHAT]: { key: 'n', usePlatformMetaKey: true },

  // New agent chat - opens home screen with agent mode pre-enabled
  [ShortcutAction.NEW_AGENT_CHAT]: { key: 'm', usePlatformMetaKey: true },

  // New project - opens create project dialog
  [ShortcutAction.NEW_PROJECT]: { key: 'p', usePlatformMetaKey: true },

  // Go to settings - different per platform to avoid browser "preferences" conflict
  [ShortcutAction.GO_TO_SETTINGS]: { key: ',', usePlatformMetaKey: true },

  // Search - opens search dialog
  [ShortcutAction.SEARCH]: { key: 'k', usePlatformMetaKey: true },

  // Switch assistant - opens the chat input assistant switcher
  [ShortcutAction.SWITCH_ASSISTANT]: { key: 'j', usePlatformMetaKey: true },

  // Zoom shortcuts - same on both platforms (standard shortcuts)
  [ShortcutAction.ZOOM_IN]: {
    key: '+',
    aliasKeys: ['=', 'Add'],
    usePlatformMetaKey: true,
  },

  [ShortcutAction.ZOOM_OUT]: {
    key: '-',
    aliasKeys: ['_', 'Subtract'],
    usePlatformMetaKey: true,
  },
}
