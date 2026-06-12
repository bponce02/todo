import { toast } from 'sonner'
import { useForm } from '@tanstack/react-form'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCreateEvent, useUpdateEvent } from '../../lib/queries'
import { eventFormSchema, firstError } from '../../lib/schemas'
import type { EventFormValues } from '../../lib/schemas'
import type { CalendarEvent } from '../../lib/events-api'
import type { List } from '../../lib/tasks-api'
import { DueDatePicker } from '../common/DueDatePicker'
import {
  allDayDateKey,
  composeIso,
  localDateKey,
  minutesToHHMM,
} from './calendar-utils'

// Prefill for create mode (from drag-to-create or the Fab).
export interface EventFormInitial {
  start_date: string
  start_time: string
  end_date: string
  end_time: string
}

function defaultsFromEvent(event: CalendarEvent): EventFormValues {
  if (event.all_day) {
    return {
      title: event.title,
      description: event.description ?? '',
      list_id: event.list_id,
      all_day: true,
      start_date: allDayDateKey(event.start),
      start_time: '09:00',
      end_date: allDayDateKey(event.end),
      end_time: '10:00',
    }
  }
  const start = new Date(event.start)
  const end = new Date(event.end)
  return {
    title: event.title,
    description: event.description ?? '',
    list_id: event.list_id,
    all_day: false,
    start_date: localDateKey(start),
    start_time: minutesToHHMM(start.getHours() * 60 + start.getMinutes()),
    end_date: localDateKey(end),
    end_time: minutesToHHMM(end.getHours() * 60 + end.getMinutes()),
  }
}

export function EventFormDrawer({
  isOpen,
  onOpenChange,
  event,
  initial,
  lists,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  event?: CalendarEvent
  initial?: EventFormInitial
  lists: Array<List>
}) {
  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        {isOpen && (
          <EventFormContents
            key={event?.id ?? 'new'}
            event={event}
            initial={initial}
            lists={lists}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}

function EventFormContents({
  event,
  initial,
  lists,
  onClose,
}: {
  event?: CalendarEvent
  initial?: EventFormInitial
  lists: Array<List>
  onClose: () => void
}) {
  const isEdit = Boolean(event)
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()

  const defaults: EventFormValues = event
    ? defaultsFromEvent(event)
    : {
        title: '',
        description: '',
        // Prefer an existing calendar-view list; useCreateEvent auto-creates
        // one when none is chosen.
        list_id:
          lists.find((l) => l.view === 'calendar')?.id ?? lists.at(0)?.id,
        all_day: false,
        start_date: initial?.start_date ?? localDateKey(new Date()),
        start_time: initial?.start_time ?? '09:00',
        end_date: initial?.end_date ?? localDateKey(new Date()),
        end_time: initial?.end_time ?? '10:00',
      }

  const form = useForm({
    defaultValues: defaults,
    validators: { onChange: eventFormSchema },
    onSubmit: async ({ value }) => {
      // All-day events are date-only: midnight-UTC datetimes whose date
      // components carry the meaning, `end` inclusive. Timed events compose
      // local date+time and send UTC.
      const payload = {
        title: value.title,
        description: value.description || null,
        all_day: value.all_day,
        start: value.all_day
          ? `${value.start_date}T00:00:00Z`
          : composeIso(value.start_date, value.start_time || '00:00'),
        end: value.all_day
          ? `${value.end_date}T00:00:00Z`
          : composeIso(value.end_date, value.end_time || '00:00'),
      }
      try {
        if (event) {
          await updateEvent.mutateAsync({
            id: event.id,
            patch: { ...payload, list_id: value.list_id },
          })
          toast.success('Event updated')
        } else {
          await createEvent.mutateAsync({ ...payload, list_id: value.list_id })
          toast.success('Event created')
        }
        onClose()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not save the event.',
        )
      }
    },
  })

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{isEdit ? 'Edit event' : 'New event'}</DrawerTitle>
      </DrawerHeader>
      <div className="overflow-y-auto px-4 pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4 pb-2"
        >
          <form.Field name="title">
            {(field) => {
              const hasErrors = field.state.meta.errors.length > 0
              return (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-form-title">Title</Label>
                  <Input
                    id="event-form-title"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={hasErrors}
                    placeholder="What's happening?"
                  />
                  {hasErrors && (
                    <p className="text-sm text-destructive">
                      {firstError(field.state.meta.errors)}
                    </p>
                  )}
                </div>
              )
            }}
          </form.Field>

          <form.Field name="all_day">
            {(field) => (
              <div className="flex items-center justify-between">
                <Label htmlFor="event-form-all-day">All day</Label>
                <Switch
                  id="event-form-all-day"
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.all_day}>
            {(allDay) => (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <form.Field name="start_date">
                    {(field) => (
                      <DueDatePicker
                        label="Start date"
                        value={field.state.value || undefined}
                        onChange={(v) => field.handleChange(v ?? '')}
                      />
                    )}
                  </form.Field>
                  {!allDay && (
                    <form.Field name="start_time">
                      {(field) => (
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="event-form-start-time">
                            Start time
                          </Label>
                          <Input
                            id="event-form-start-time"
                            type="time"
                            value={field.state.value ?? ''}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  <form.Field name="end_date">
                    {(field) => {
                      const hasErrors = field.state.meta.errors.length > 0
                      return (
                        <div className="flex flex-col gap-2">
                          <DueDatePicker
                            label="End date"
                            value={field.state.value || undefined}
                            onChange={(v) => field.handleChange(v ?? '')}
                          />
                          {hasErrors && (
                            <p className="text-sm text-destructive">
                              {firstError(field.state.meta.errors)}
                            </p>
                          )}
                        </div>
                      )
                    }}
                  </form.Field>
                  {!allDay && (
                    <form.Field name="end_time">
                      {(field) => (
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="event-form-end-time">End time</Label>
                          <Input
                            id="event-form-end-time"
                            type="time"
                            value={field.state.value ?? ''}
                            onChange={(e) => field.handleChange(e.target.value)}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </div>
              </div>
            )}
          </form.Subscribe>

          <form.Field name="description">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-form-description">Description</Label>
                <Textarea
                  id="event-form-description"
                  value={field.state.value ?? ''}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Add more detail (optional)"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="list_id">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-form-list">Calendar</Label>
                <Select
                  value={
                    field.state.value != null ? String(field.state.value) : ''
                  }
                  onValueChange={(key) =>
                    field.handleChange(key ? Number(key) : undefined)
                  }
                >
                  <SelectTrigger id="event-form-list" className="w-full">
                    <SelectValue placeholder="Select a calendar" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={String(list.id)}>
                        {list.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {lists.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    A default calendar will be created.
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Subscribe
            selector={(s) => ({
              canSubmit: s.canSubmit,
              isSubmitting: s.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? <Spinner /> : null}
                  {isEdit ? 'Save changes' : 'Create event'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </div>
    </>
  )
}
