import { useI18n } from '../i18n/I18nProvider'
import type { Avatar } from '../store/records'

export const AVATAR_SYMBOLS: Record<Avatar, string> = {
  violin: '🎻',
  note: '🎵',
  clef: '🎼',
  star: '⭐',
  sun: '☀️',
  moon: '🌙',
  bird: '🐦',
  cat: '🐱',
  dog: '🐶',
  flower: '🌸',
  tree: '🌳',
  heart: '❤️',
}

export const AVATARS = Object.keys(AVATAR_SYMBOLS) as Avatar[]

export function AvatarIcon({ avatar }: { avatar: Avatar }) {
  const { t } = useI18n()
  return (
    <span className="avatar" role="img" aria-label={t.profiles.avatars[avatar]}>
      {AVATAR_SYMBOLS[avatar]}
    </span>
  )
}
