const ACCESS_KEY = 'pm_access'
const REFRESH_KEY = 'pm_refresh'
const USER_KEY = 'pm_user'

const ok = typeof document !== 'undefined'

// The access JWT is short-lived (the API expires it server-side in ~5 min) and
// gets rotated via the refresh flow. The refresh token anchors the session, so
// we treat its presence as "logged in". Cookies are scoped to this site only.
const DAY = 60 * 60 * 24

function readCookie(name: string): string | null {
  if (!ok) return null
  const escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1')
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + escaped + '=([^;]*)'),
  )
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(name: string, value: string, maxAge: number): void {
  if (!ok) return
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Strict` +
    secure
}

function deleteCookie(name: string): void {
  if (!ok) return
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict`
}

export const auth = {
  getToken: (): string | null => readCookie(ACCESS_KEY),
  getRefresh: (): string | null => readCookie(REFRESH_KEY),
  getUsername: (): string | null => readCookie(USER_KEY),
  setTokens: (access: string, refresh: string, username?: string): void => {
    writeCookie(ACCESS_KEY, access, DAY)
    writeCookie(REFRESH_KEY, refresh, DAY)
    if (username) writeCookie(USER_KEY, username, DAY)
  },
  setAccess: (access: string): void => {
    writeCookie(ACCESS_KEY, access, DAY)
  },
  clear: (): void => {
    deleteCookie(ACCESS_KEY)
    deleteCookie(REFRESH_KEY)
    deleteCookie(USER_KEY)
  },
  isAuthenticated: (): boolean => Boolean(readCookie(REFRESH_KEY)),
}
