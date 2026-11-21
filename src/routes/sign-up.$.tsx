import { SignUp } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-up/$')({
  component: Page,
})

function Page() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <img src="/favicon.svg" alt="" className="mx-auto size-11" />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">PyQuiz</h1>
        <p className="mt-1 text-sm text-muted-foreground">One data analyst quiz a day: Python, pandas, stats and more.</p>
      </div>
      <SignUp />
    </div>
  )
}
