import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { listsApi, tasksApi } from './tasks-api'
import type { Task, TaskPatch } from './tasks-api'
import { eventsApi } from './events-api'
import type { EventInput, EventPatch } from './events-api'

export const queryKeys = {
  lists: ['lists'] as const,
  tasks: ['tasks'] as const,
  tasksBy: (listId?: number) => ['tasks', listId ?? 'all'] as const,
  events: ['events'] as const,
  eventsInRange: (start: string, end: string) =>
    ['events', start, end] as const,
}

const DEFAULT_LIST_TITLE = 'My Tasks'
const DEFAULT_CALENDAR_TITLE = 'My Calendar'

// ---- Queries ----

export function useLists() {
  return useQuery({ queryKey: queryKeys.lists, queryFn: listsApi.list })
}

export function useTasks(listId?: number) {
  return useQuery({
    queryKey: queryKeys.tasksBy(listId),
    queryFn: () => tasksApi.list(listId != null ? { listId } : undefined),
  })
}

// ---- List mutations ----

export function useCreateList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (title: string) => listsApi.create(title),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lists }),
  })
}

export function useRenameList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      listsApi.update(id, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.lists }),
  })
}

export function useDeleteList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => listsApi.remove(id),
    // Deleting a list cascades to its tasks on the backend.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lists })
      qc.invalidateQueries({ queryKey: queryKeys.tasks })
    },
  })
}

export function useBulkDeleteLists() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: Array<number>) =>
      Promise.all(ids.map((id) => listsApi.remove(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.lists })
      qc.invalidateQueries({ queryKey: queryKeys.tasks })
    },
  })
}

// ---- Task mutations ----

export interface CreateTaskInput {
  title: string
  description?: string | null
  due_date?: string | null
  list_id?: number
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      // A task must always belong to a list. If none was chosen (because none
      // exist yet), create a default list and use it.
      let listId = input.list_id
      if (listId == null) {
        const existing = await listsApi.list()
        listId =
          existing[0]?.id ?? (await listsApi.create(DEFAULT_LIST_TITLE)).id
      }
      return tasksApi.create({
        title: input.title,
        list_id: listId,
        description: input.description || null,
        due_date: input.due_date || null,
        completed: false,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks })
      qc.invalidateQueries({ queryKey: queryKeys.lists })
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: TaskPatch }) =>
      tasksApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => tasksApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks })
      qc.invalidateQueries({ queryKey: queryKeys.lists })
    },
  })
}

export function useBulkUpdateTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, patch }: { ids: Array<number>; patch: TaskPatch }) =>
      Promise.all(ids.map((id) => tasksApi.update(id, patch))),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}

export function useBulkDeleteTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: Array<number>) =>
      Promise.all(ids.map((id) => tasksApi.remove(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks })
      qc.invalidateQueries({ queryKey: queryKeys.lists })
    },
  })
}

// ---- Event queries & mutations ----

export function useEvents(rangeStart: string, rangeEnd: string) {
  return useQuery({
    queryKey: queryKeys.eventsInRange(rangeStart, rangeEnd),
    queryFn: () => eventsApi.list({ start: rangeStart, end: rangeEnd }),
    // Keep the previous week's events on screen while the next loads.
    placeholderData: keepPreviousData,
  })
}

export interface CreateEventInput extends Omit<EventInput, 'list_id'> {
  list_id?: number
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      // An event must always belong to a list. If none was chosen, prefer an
      // existing calendar-view list, else create a default calendar.
      let listId = input.list_id
      if (listId == null) {
        const existing = await listsApi.list()
        listId =
          existing.find((l) => l.view === 'calendar')?.id ??
          (await listsApi.create(DEFAULT_CALENDAR_TITLE, 'calendar')).id
      }
      return eventsApi.create({ ...input, list_id: listId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.events })
      qc.invalidateQueries({ queryKey: queryKeys.lists })
    },
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: EventPatch }) =>
      eventsApi.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.events }),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => eventsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.events }),
  })
}

export function useBulkDuplicateTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tasks: Array<Task>) =>
      Promise.all(
        tasks.map((t) =>
          tasksApi.create({
            title: t.title,
            list_id: t.list_id,
            description: t.description,
            due_date: t.due_date,
            completed: false,
          }),
        ),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks }),
  })
}
