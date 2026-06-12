import {
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { Calendar, CheckSquare, List, ListChecks, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { auth } from '../lib/auth'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (typeof window === 'undefined') return
    if (!auth.isAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AuthenticatedLayout,
})

const ROUTES = {
  tasks: '/tasks',
  lists: '/lists',
  calendar: '/calendar',
} as const

type TabKey = keyof typeof ROUTES

// Primary navigation, rendered in two places (desktop header / mobile bottom
// bar). Both instances stay in sync because the selected tab is derived from
// the current route and selecting one navigates.
function PrimaryTabs() {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })
  const selected: TabKey | '' = pathname.startsWith('/lists')
    ? 'lists'
    : pathname.startsWith('/calendar')
      ? 'calendar'
      : pathname.startsWith('/tasks')
        ? 'tasks'
        : ''

  return (
    <Tabs
      value={selected}
      onValueChange={(key) => navigate({ to: ROUTES[key as TabKey] })}
    >
      <TabsList
        aria-label="Primary navigation"
        className="bg-background shadow-sm border md:border-0 md:shadow-none md:bg-muted"
      >
        <TabsTrigger value="tasks" className="h-8 px-4">
          <ListChecks className="size-4 mr-1" />
          Tasks
        </TabsTrigger>
        <TabsTrigger value="lists" className="h-8 px-4">
          <List className="size-4 mr-1" />
          Lists
        </TabsTrigger>
        <TabsTrigger value="calendar" className="h-8 px-4">
          <Calendar className="size-4 mr-1" />
          Calendar
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function AuthenticatedLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 py-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-2">
            <CheckSquare className="size-5" />
            <span className="font-semibold">Personal Tasks</span>
          </div>

          <div className="hidden md:block">
            <PrimaryTabs />
          </div>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/settings' })}
            >
              <Settings />
            </Button>
          </div>
        </div>
      </header>
      <Separator />

      <main className="flex-1 px-4 pb-28 md:pb-6">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile: fixed, centered, floating above all content */}
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 md:hidden">
        <PrimaryTabs />
      </div>
    </div>
  )
}
