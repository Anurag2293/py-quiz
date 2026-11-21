import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { TIMER_DEFAULT, TIMER_MAX, TIMER_MIN } from '../../../convex/lib/tracks'
import { FullPageSpinner } from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export const Route = createFileRoute('/_authed/settings')({ component: SettingsPage })

function SettingsPage() {
  const me = useQuery(api.users.me)
  const update = useMutation(api.users.updateSettings)
  const [minutes, setMinutes] = useState<number>(TIMER_DEFAULT)
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (me) {
      setMinutes(me.timerMinutes)
      setTimezone(me.timezone)
    }
  }, [me])

  const zones = useMemo(() => {
    let list: string[]
    try {
      list = Intl.supportedValuesOf('timeZone').filter((z) => z !== 'Asia/Calcutta')
    } catch {
      list = ['UTC']
    }
    return [...new Set(['Asia/Kolkata', me?.timezone ?? 'Asia/Kolkata', ...list])].sort()
  }, [me?.timezone])

  if (!me) return <FullPageSpinner />
  const dirty = minutes !== me.timerMinutes || timezone !== me.timezone

  const save = async () => {
    setSaving(true)
    try {
      await update({ timerMinutes: minutes, timezone })
      toast.success('Settings saved')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Quiz timer</h2>
            <span className="text-2xl font-semibold tabular-nums">{minutes} min</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            How long you get for the 30 questions. Applies to the next quiz you start.
          </p>
          <Slider
            className="mt-5"
            min={TIMER_MIN}
            max={TIMER_MAX}
            step={1}
            value={[minutes]}
            onValueChange={(v) => setMinutes(Array.isArray(v) ? v[0] : (v as number))}
            aria-label="Quiz timer in minutes"
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{TIMER_MIN} min</span>
            <span>{TIMER_MAX} min</span>
          </div>
        </div>

        <div>
          <h2 className="font-medium">Time zone</h2>
          <p className="mt-1 text-sm text-muted-foreground">A new quiz unlocks at midnight in this time zone.</p>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-3 h-9 w-full rounded-lg border bg-background px-3 text-sm"
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </section>
    </div>
  )
}
