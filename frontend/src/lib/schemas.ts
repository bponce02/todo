import { z } from 'zod'

// Task create/edit form. `due_date` is an ISO date string (YYYY-MM-DD) or empty.
// `list_id` is optional here: when no lists exist yet, the create mutation
// auto-creates a default list (see useCreateTask), so the form can submit
// without an explicit selection.
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
  due_date: z.string().optional(),
  list_id: z.number().int().positive().optional(),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>

export const listFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
})

export type ListFormValues = z.infer<typeof listFormSchema>

// Event create/edit form. Dates are ISO date strings (YYYY-MM-DD) and times
// are HH:mm; the form composes them into UTC ISO datetimes on submit. Times
// are ignored when all_day is set. `list_id` is optional like in
// taskFormSchema: useCreateEvent auto-creates a default calendar list.
export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required'),
    description: z.string().trim().optional(),
    list_id: z.number().int().positive().optional(),
    all_day: z.boolean(),
    start_date: z.string().min(1, 'Start date is required'),
    start_time: z.string().optional(),
    end_date: z.string().min(1, 'End date is required'),
    end_time: z.string().optional(),
  })
  .refine(
    (v) => {
      if (!v.start_date || !v.end_date) return true
      const start = `${v.start_date}T${v.all_day ? '00:00' : v.start_time || '00:00'}`
      const end = `${v.end_date}T${v.all_day ? '00:00' : v.end_time || '00:00'}`
      return end >= start
    },
    { message: 'End must not be before start', path: ['end_date'] },
  )

export type EventFormValues = z.infer<typeof eventFormSchema>

// Pull the first message out of TanStack Form's standard-schema errors, which
// may be plain strings or `{ message }` issue objects.
export function firstError(errors: Array<unknown>): string | undefined {
  for (const e of errors) {
    if (!e) continue
    if (typeof e === 'string') return e
    if (typeof e === 'object' && 'message' in e) {
      const m = (e as { message?: unknown }).message
      if (typeof m === 'string') return m
    }
  }
  return undefined
}
