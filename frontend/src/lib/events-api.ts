import { apiFetch } from './api'
import { jsonOrThrow, okOrThrow } from './tasks-api'

// Named CalendarEvent (not Event) to avoid clashing with the DOM Event type.
export interface CalendarEvent {
  id: number
  list_id: number
  title: string
  description: string | null
  // ISO datetimes (UTC, Z-suffixed from the backend). For all-day events the
  // date components are what matter; `end` is inclusive.
  start: string
  end: string
  all_day: boolean
}

export interface EventInput {
  title: string
  list_id: number
  start: string
  end: string
  description?: string | null
  all_day?: boolean
}

export type EventPatch = Partial<EventInput>

export const eventsApi = {
  // start/end filter with overlap semantics: events spanning the window edge
  // are included, which is what a calendar grid needs.
  list: (params?: { start?: string; end?: string; listId?: number }) => {
    const q = new URLSearchParams()
    if (params?.start) q.set('start', params.start)
    if (params?.end) q.set('end', params.end)
    if (params?.listId != null) q.set('list_id', String(params.listId))
    const qs = q.toString()
    return apiFetch(`/api/events${qs ? `?${qs}` : ''}`).then((r) =>
      jsonOrThrow<Array<CalendarEvent>>(r),
    )
  },
  get: (id: number) =>
    apiFetch(`/api/events/${id}`).then((r) => jsonOrThrow<CalendarEvent>(r)),
  create: (input: EventInput) =>
    apiFetch('/api/events', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => jsonOrThrow<CalendarEvent>(r)),
  update: (id: number, patch: EventPatch) =>
    apiFetch(`/api/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => jsonOrThrow<CalendarEvent>(r)),
  remove: (id: number) =>
    apiFetch(`/api/events/${id}`, { method: 'DELETE' }).then(okOrThrow),
}
