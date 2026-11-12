export type NotificationPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export const NOTIFICATION_POSITIONS: readonly NotificationPosition[] = [
  'top-right',
  'top-left',
  'bottom-right',
  'bottom-left',
] as const

export function getDefaultNotificationPosition(): NotificationPosition {
  return 'bottom-right'
}

export function isNotificationPosition(value: unknown): value is NotificationPosition {
  return value === 'top-left' || value === 'top-right' || value === 'bottom-left' || value === 'bottom-right'
}
