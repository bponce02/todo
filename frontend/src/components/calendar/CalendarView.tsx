import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getLocalTimeZone, startOfWeek, today } from '@internationalized/date'
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useEvents, useLists, useUpdateEvent } from '../../lib/queries'
import type { CalendarEvent } from '../../lib/events-api'
import { Fab } from '../common/Fab'
import { WeekGrid } from './WeekGrid'
import type { MoveCommit, ResizeCommit } from './WeekGrid'
import { EventFormDrawer } from './EventFormDrawer'
import type { EventFormInitial } from './EventFormDrawer'
import { EventDetailDialog } from './EventDetailDialog'
import {
  addDays,
  localDateKey,
  minutesToHHMM,
  startOfLocalDay,
} from './calendar-utils'

function currentWeekStart(): Date {
  const tz = getLocalTimeZone()
  return startOfWeek(today(tz), navigator.language).toDate(tz)
}

export function CalendarView() {
  const [weekStart, setWeekStart] = useState<Date>(() => currentWeekStart())

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )
  // Overlap-filtered window: the whole visible week, inclusive of its edges.
  const rangeStart = useMemo(() => weekStart.toISOString(), [weekStart])
  const rangeEnd = useMemo(
    () => addDays(weekStart, 7).toISOString(),
    [weekStart],
  )

  const listsQuery = useLists()
  const eventsQuery = useEvents(rangeStart, rangeEnd)
  const updateEvent = useUpdateEvent()
  const lists = listsQuery.data ?? []
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists])
  const events = eventsQuery.data ?? []

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(
    undefined,
  )
  const [formInitial, setFormInitial] = useState<EventFormInitial | undefined>(
    undefined,
  )
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const monthLabel = useMemo(() => {
    // Label by the week's midpoint so a week straddling a month boundary
    // shows the month most of it belongs to.
    const mid = addDays(weekStart, 3)
    return mid.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  }, [weekStart])

  function openCreate(initial?: EventFormInitial) {
    setEditingEvent(undefined)
    setFormInitial(initial)
    setDrawerOpen(true)
  }

  function openCreateNow() {
    const now = new Date()
    const nextHour =
      now.getMinutes() === 0 ? now.getHours() : now.getHours() + 1
    const day = nextHour >= 24 ? addDays(startOfLocalDay(now), 1) : now
    const startMin = (nextHour % 24) * 60
    openCreate({
      start_date: localDateKey(day),
      start_time: minutesToHHMM(startMin),
      end_date: localDateKey(day),
      end_time: minutesToHHMM(Math.min(startMin + 60, 23 * 60 + 45)),
    })
  }

  function openDetail(event: CalendarEvent) {
    setDetailEvent(event)
    setDetailOpen(true)
  }

  function openEdit(event: CalendarEvent) {
    setDetailOpen(false)
    setEditingEvent(event)
    setFormInitial(undefined)
    setDrawerOpen(true)
  }

  function handleCreateRange(day: Date, startMin: number, endMin: number) {
    openCreate({
      start_date: localDateKey(day),
      start_time: minutesToHHMM(startMin),
      end_date: localDateKey(endMin >= 24 * 60 ? day : day),
      end_time: minutesToHHMM(Math.min(endMin, 23 * 60 + 45)),
    })
  }

  async function handleMove({ event, deltaMinutes }: MoveCommit) {
    const shift = deltaMinutes * 60000
    try {
      if (event.all_day) {
        // All-day events move in whole days, preserving date-only semantics.
        const deltaDays = Math.round(deltaMinutes / (24 * 60))
        if (deltaDays === 0) return
        const shiftDate = (iso: string) => {
          const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
          const moved = new Date(Date.UTC(y, m - 1, d + deltaDays))
          return moved.toISOString()
        }
        await updateEvent.mutateAsync({
          id: event.id,
          patch: { start: shiftDate(event.start), end: shiftDate(event.end) },
        })
      } else {
        await updateEvent.mutateAsync({
          id: event.id,
          patch: {
            start: new Date(
              new Date(event.start).getTime() + shift,
            ).toISOString(),
            end: new Date(new Date(event.end).getTime() + shift).toISOString(),
          },
        })
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not move the event.',
      )
    }
  }

  async function handleResize({ event, edge, boundary }: ResizeCommit) {
    try {
      await updateEvent.mutateAsync({
        id: event.id,
        patch:
          edge === 'top'
            ? { start: boundary.toISOString() }
            : { end: boundary.toISOString() },
      })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not resize the event.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Week navigation */}
      <div className="flex items-center gap-2">
        <h2 className="flex-1 truncate text-2xl font-semibold">{monthLabel}</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setWeekStart(currentWeekStart())}
        >
          Today
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Previous week"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Next week"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
        >
          <ChevronRight />
        </Button>
      </div>

      {eventsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : eventsQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load events</AlertTitle>
          <AlertDescription>
            {eventsQuery.error instanceof Error
              ? eventsQuery.error.message
              : 'Please try again.'}
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => eventsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <WeekGrid
          days={days}
          events={events}
          onSelectEvent={openDetail}
          onCreateRange={handleCreateRange}
          onMove={handleMove}
          onResize={handleResize}
        />
      )}

      <Fab label="New event" onPress={openCreateNow} />

      <EventFormDrawer
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        event={editingEvent}
        initial={formInitial}
        lists={lists}
      />

      <EventDetailDialog
        event={detailEvent}
        listName={
          detailEvent ? listById.get(detailEvent.list_id)?.title : undefined
        }
        isOpen={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
      />
    </div>
  )
}
