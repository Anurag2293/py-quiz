import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { RotateCcwIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'

export function RetryButton({ quizId, variant = 'outline' }: { quizId: Id<'quizzes'>; variant?: 'default' | 'outline' }) {
  const navigate = useNavigate()
  const retry = useMutation(api.quiz.retry)
  const [busy, setBusy] = useState(false)

  const onRetry = async () => {
    setBusy(true)
    try {
      const id = await retry({ quizId })
      await navigate({ to: '/quiz/$quizId', params: { quizId: id } })
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Button variant={variant} onClick={onRetry} disabled={busy}>
      <RotateCcwIcon data-icon="inline-start" /> {busy ? 'Starting…' : 'Retry quiz'}
    </Button>
  )
}
