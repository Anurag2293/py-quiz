import { TRACKS } from '../../convex/lib/tracks'
import { TRACK_COLORS } from '@/lib/tracks-ui'
import { cn } from '@/lib/utils'

export function TrackChip({ track, className }: { track: string; className?: string }) {
  const label = TRACKS.find((t) => t.id === track)?.label ?? track
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        TRACK_COLORS[track]?.chip,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', TRACK_COLORS[track]?.dot)} />
      {label}
    </span>
  )
}
