import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { auth } from './auth'
import { obtainTokenPair } from './api'

interface Credentials {
  username: string
  password: string
}

// Sign in with username/password. On success the JWT pair is stored in cookies
// and the user is sent to their tasks.
export function useLogin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ username, password }: Credentials) =>
      obtainTokenPair(username, password),
    onSuccess: (data) => {
      auth.setTokens(data.access, data.refresh, data.username)
      queryClient.clear()
      navigate({ to: '/tasks' })
    },
  })
}

// Clear the session (cookies + cached queries) and return to the welcome page.
export function useLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return () => {
    auth.clear()
    queryClient.clear()
    navigate({ to: '/' })
  }
}
