import { ApiError, apiFetch } from './api'

export interface List {
  id: number
  title: string
  view: 'list' | 'calendar'
}

export interface Task {
  id: number
  list_id: number
  title: string
  description: string | null
  completed: boolean
  // ISO date (YYYY-MM-DD) — the backend field is date-only (DUE;VALUE=DATE).
  due_date: string | null
}

export interface TaskInput {
  title: string
  list_id: number
  description?: string | null
  completed?: boolean
  due_date?: string | null
}

export type TaskPatch = Partial<TaskInput>

export async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw await toError(res)
  return res.json() as Promise<T>
}

export async function okOrThrow(res: Response): Promise<void> {
  if (!res.ok) throw await toError(res)
}

async function toError(res: Response): Promise<ApiError> {
  let detail = ''
  try {
    const body = await res.json()
    detail = body?.detail ?? body?.message ?? ''
  } catch {
    /* no JSON body */
  }
  return new ApiError(res.status, detail || `Request failed (${res.status})`)
}

export const listsApi = {
  list: () => apiFetch('/api/lists').then((r) => jsonOrThrow<Array<List>>(r)),
  create: (title: string, view?: 'list' | 'calendar') =>
    apiFetch('/api/lists', {
      method: 'POST',
      body: JSON.stringify({ title, ...(view && { view }) }),
    }).then((r) => jsonOrThrow<List>(r)),
  update: (id: number, patch: { title?: string }) =>
    apiFetch(`/api/lists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => jsonOrThrow<List>(r)),
  remove: (id: number) =>
    apiFetch(`/api/lists/${id}`, { method: 'DELETE' }).then(okOrThrow),
}

export const tasksApi = {
  list: (params?: { listId?: number; completed?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.listId != null) q.set('list_id', String(params.listId))
    if (params?.completed != null) q.set('completed', String(params.completed))
    const qs = q.toString()
    return apiFetch(`/api/tasks${qs ? `?${qs}` : ''}`).then((r) =>
      jsonOrThrow<Array<Task>>(r),
    )
  },
  get: (id: number) =>
    apiFetch(`/api/tasks/${id}`).then((r) => jsonOrThrow<Task>(r)),
  create: (input: TaskInput) =>
    apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => jsonOrThrow<Task>(r)),
  update: (id: number, patch: TaskPatch) =>
    apiFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => jsonOrThrow<Task>(r)),
  remove: (id: number) =>
    apiFetch(`/api/tasks/${id}`, { method: 'DELETE' }).then(okOrThrow),
}
