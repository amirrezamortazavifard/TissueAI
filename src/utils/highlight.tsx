import React from 'react'

/**
 * Highlight fuzzy search matches in a string.
 * Returns a React element with matching characters highlighted.
 */
export function highlightFzfMatch(
  text: string,
  positions: number[],
  className: string = 'text-primary'
): React.ReactNode {
  if (!positions || positions.length === 0) {
    return text
  }

  const posSet = new Set(positions)
  const parts: React.ReactNode[] = []
  let current = ''
  let isInMatch = false

  for (let i = 0; i < text.length; i++) {
    const isMatch = posSet.has(i)

    if (isMatch && !isInMatch) {
      // Start of a new match
      if (current) {
        parts.push(current)
        current = ''
      }
      isInMatch = true
      current = text[i]
    } else if (isMatch && isInMatch) {
      // Continuation of match
      current += text[i]
    } else if (!isMatch && isInMatch) {
      // End of match
      parts.push(
        React.createElement('span', { key: `m-${i}`, className }, current)
      )
      current = text[i]
      isInMatch = false
    } else {
      // Not in match
      current += text[i]
    }
  }

  // Flush remaining
  if (current) {
    if (isInMatch) {
      parts.push(
        React.createElement('span', { key: 'm-end', className }, current)
      )
    } else {
      parts.push(current)
    }
  }

  return parts.length === 1 && typeof parts[0] === 'string'
    ? parts[0]
    : React.createElement(React.Fragment, null, ...parts)
}
