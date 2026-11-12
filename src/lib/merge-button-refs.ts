import { type RefCallback } from 'react'

export function mergeButtonRefs(...refs: Array<unknown>): RefCallback<HTMLElement> {
  return (element) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') ref(element)
      else if (ref && typeof ref === 'object' && 'current' in ref) {
        ;(ref as { current: HTMLElement | null }).current = element
      }
    })
  }
}
