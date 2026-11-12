import { memo, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

async function fetchOsUsername(): Promise<string> {
  try {
    return await invoke<string>('get_os_username')
  } catch {
    return 'User'
  }
}

function getStoredUserName(): { full: string; initials: string } {
  try {
    const stored = localStorage.getItem('tissueai_display_name')
    if (stored?.trim()) {
      const full = stored.trim()
      const parts = full.split(/\s+/).filter(Boolean)
      const initials = (parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? 'U')
      return { full, initials: initials.toUpperCase() }
    }
  } catch {
    // ignore
  }
  return { full: 'User', initials: 'U' }
}

const UserProfileChip = memo(function UserProfileChip() {
  const [userName, setUserName] = useState(getStoredUserName)

  useEffect(() => {
    const loadUsername = async () => {
      const osName = await fetchOsUsername()
      const stored = localStorage.getItem('tissueai_display_name')
      if (!stored?.trim()) {
        const parts = osName.split(/\s+/).filter(Boolean)
        const initials = (parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? 'U')
        setUserName({ full: osName, initials: initials.toUpperCase() })
      }
    }
    loadUsername()
  }, [])

  return (
    <div className="chat-user-chip">
      <div
        className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white"
        style={{
          background:
            'linear-gradient(135deg, #5BA8F5 0%, #8b5cf6 55%, #06b6d4 100%)',
          boxShadow: '0 2px 10px rgba(91, 168, 245, 0.35)',
        }}
      >
        {userName.initials}
      </div>
      <span className="text-sm font-medium text-foreground">{userName.full}</span>
      <ChevronDown size={14} className="text-muted-foreground" />
    </div>
  )
})

export default UserProfileChip
