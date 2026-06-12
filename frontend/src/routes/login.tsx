import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { AlertCircle, CheckSquare } from 'lucide-react'
import { auth } from '../lib/auth'
import { useLogin } from '../lib/auth-hooks'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (auth.isAuthenticated()) {
      throw redirect({ to: '/tasks' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    login.mutate({ username, password })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-center gap-2">
          <CheckSquare className="size-6" />
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {login.isError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>{login.error.message}</AlertTitle>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="mt-4">
            <Button type="submit" disabled={login.isPending} className="w-full">
              {login.isPending ? <Spinner /> : null}
              Sign in
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
