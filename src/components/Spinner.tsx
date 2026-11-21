import { Loader2Icon } from 'lucide-react'

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2Icon className="size-6 animate-spin" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}
