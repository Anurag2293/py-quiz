import { RedirectToSignIn, useAuth } from '@clerk/tanstack-react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useConvexAuth, useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { AppShell } from '@/components/AppShell'
import { FullPageSpinner } from '@/components/Spinner'

const fetchAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()
  return { userId }
})

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    if (typeof window !== 'undefined') return
    const { userId } = await fetchAuth()
    if (!userId) {
      throw redirect({ href: `/sign-in?redirect_url=${encodeURIComponent(location.href)}` })
    }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { isLoaded, isSignedIn } = useAuth()
  const { isLoading, isAuthenticated } = useConvexAuth()

  if (isLoaded && !isSignedIn) return <RedirectToSignIn />
  if (!isLoaded || isLoading) return <FullPageSpinner />
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-semibold">Can't reach the quiz backend</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in, but the database didn't accept your session. Check the Clerk JWT template named
          "convex" and CLERK_JWT_ISSUER_DOMAIN in Convex.
        </p>
      </div>
    )
  }
  return (
    <AppShell>
      <EnsureUser>
        <Outlet />
      </EnsureUser>
    </AppShell>
  )
}

function EnsureUser({ children }: { children: React.ReactNode }) {
  const ensure = useMutation(api.users.ensure)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensure()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message))
  }, [ensure])

  if (error) return <p className="py-24 text-center text-sm text-destructive">{error}</p>
  if (!ready) return <FullPageSpinner />
  return <>{children}</>
}
