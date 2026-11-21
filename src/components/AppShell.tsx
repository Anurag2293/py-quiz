import { UserButton } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Today' },
  { to: '/history', label: 'Progress' },
  { to: '/settings', label: 'Settings' },
] as const

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link to="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="hidden sm:inline">PyQuiz</span>
          </Link>
          <nav className="flex items-center gap-0.5 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === '/' }}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:pt-8">{children}</main>
    </div>
  )
}
