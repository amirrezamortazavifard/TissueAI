export function AvatarEmoji({ emoji, name, avatar, imageClassName, textClassName }: { emoji?: string; name?: string; avatar?: string; imageClassName?: string; textClassName?: string }) {
  if (avatar) {
    return <img src={avatar} alt={name || ''} className={imageClassName || 'size-8 rounded-full'} />
  }
  return (
    <div className={textClassName || 'flex items-center justify-center size-8 rounded-full bg-muted text-lg'}>
      {emoji || name?.charAt(0) || '?'}
    </div>
  )
}
