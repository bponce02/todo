import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, LogOut, Moon, Server, Sun } from 'lucide-react'
import { useLogout } from '../../lib/auth-hooks'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return {
    theme,
    toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  }
}

const iosSteps = [
  'Open Settings > Calendar > Accounts',
  'Tap Add Account > Other > Add CalDAV Account',
  "Server: your host's LAN IP and port 5232 (e.g. 192.168.1.x:5232)",
  'Enter your Radicale username and password',
  'Tap Next — tasks appear in Reminders automatically',
]

const androidSteps = [
  'Install DAVx5 from the Play Store',
  'Add account > Login with URL',
  'Base URL: http://192.168.1.x:5232 with your Radicale credentials',
  'Enable the task calendars and sync',
]

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-1.5 pl-1">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2">
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {i + 1}.
          </span>
          <span className="text-sm text-muted-foreground">{step}</span>
        </li>
      ))}
    </ol>
  )
}

function SettingsPage() {
  const { theme, toggle } = useTheme()
  const logout = useLogout()
  const router = useRouter()
  const isDark = theme === 'dark'

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.history.back()}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-2xl font-semibold">Settings</h2>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
            Appearance
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="py-4">
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dark-mode" className="font-medium">
                Dark mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark theme
              </p>
            </div>
            <Switch id="dark-mode" checked={isDark} onCheckedChange={toggle} />
          </div>
        </CardContent>
      </Card>

      {/* CalDAV sync */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="text-base">Phone sync (CalDAV)</CardTitle>
          <CardDescription>
            Connect your phone to sync tasks via the local Radicale server.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="flex flex-col gap-6 py-4">
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <Server className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-sm text-muted-foreground">
              Both your phone and this server must be on the same local network. Use your
              host machine&apos;s LAN IP — not localhost.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-semibold">iOS</p>
            <StepList steps={iosSteps} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-semibold">Android</p>
            <StepList steps={androidSteps} />
          </div>
        </CardContent>
      </Card> */}

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="py-4">
          <Button variant="destructive" onClick={logout} className="ml-auto">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
