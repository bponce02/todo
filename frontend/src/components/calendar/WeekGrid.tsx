import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '../../lib/events-api'
import {
  DAY_HEIGHT,
  HOUR_HEIGHT,
  MINUTES_PER_DAY,
  MINUTE_HEIGHT,
  SNAP_MINUTES,
  clamp,
  dateAtMinutes,
  formatTime,
  isAllDayOn,
  layoutSegments,
  localDateKey,
  minutesToHHMM,
  snapMinutes,
  timedSegmentsForDay,
} from './calendar-utils'
import type { PositionedSegment } from './calendar-utils'

export interface MoveCommit {
  event: CalendarEvent
  // Whole-event shift in minutes (covers both day and time changes).
  deltaMinutes: number
}

export interface ResizeCommit {
  event: CalendarEvent
  edge: 'top' | 'bottom'
  // New boundary as a local datetime.
  boundary: Date
}

interface DragData {
  event: CalendarEvent
  dayIndex: number
}

export function WeekGrid({
  days,
  events,
  onSelectEvent,
  onCreateRange,
  onMove,
  onResize,
}: {
  days: Array<Date>
  events: Array<CalendarEvent>
  onSelectEvent: (event: CalendarEvent) => void
  onCreateRange: (day: Date, startMin: number, endMin: number) => void
  onMove: (commit: MoveCommit) => void
  onResize: (commit: ResizeCommit) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Suppresses the click that lands right after a real drag finishes.
  const justDraggedRef = useRef(false)

  useEffect(() => {
    // Open on the working part of the day, not midnight.
    scrollRef.current?.scrollTo({ top: 7 * HOUR_HEIGHT })
  }, [])

  const sensors = useSensors(
    // A small distance threshold keeps plain clicks (open detail) from
    // starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const todayKey = localDateKey(new Date())

  const segmentsByDay = useMemo(
    () => days.map((day) => layoutSegments(timedSegmentsForDay(events, day))),
    [days, events],
  )
  const allDayByDay = useMemo(
    () =>
      days.map((day) => events.filter((e) => e.all_day && isAllDayOn(e, day))),
    [days, events],
  )
  const hasAllDay = allDayByDay.some((list) => list.length > 0)

  function selectEvent(event: CalendarEvent) {
    if (justDraggedRef.current) return
    onSelectEvent(event)
  }

  function handleDragEnd(dragEvent: DragEndEvent) {
    const data = dragEvent.active.data.current as DragData | undefined
    if (!data || !dragEvent.over) return
    const targetDay = Number(String(dragEvent.over.id).replace('day-', ''))
    const deltaMin = snapMinutes(dragEvent.delta.y / MINUTE_HEIGHT)
    const deltaDays = targetDay - data.dayIndex
    if (deltaDays === 0 && deltaMin === 0) return
    justDraggedRef.current = true
    setTimeout(() => {
      justDraggedRef.current = false
    }, 150)
    onMove({
      event: data.event,
      deltaMinutes: deltaDays * MINUTES_PER_DAY + deltaMin,
    })
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto rounded-md border bg-background select-none">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="flex border-b bg-muted/40">
            <div className="w-14 shrink-0 border-r" />
            {days.map((day) => {
              const isToday = localDateKey(day) === todayKey
              return (
                <div
                  key={localDateKey(day)}
                  className="flex flex-1 items-center justify-center gap-1.5 border-r px-2 py-2 text-sm last:border-r-0"
                >
                  <span className="text-muted-foreground">
                    {day.toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full font-medium',
                      isToday && 'bg-primary text-primary-foreground',
                    )}
                  >
                    {day.getDate()}
                  </span>
                </div>
              )
            })}
          </div>

          {/* All-day strip */}
          {hasAllDay && (
            <div className="flex border-b">
              <div className="flex w-14 shrink-0 items-center justify-end border-r pr-1.5 text-[10px] text-muted-foreground">
                all-day
              </div>
              {days.map((day) => (
                <div
                  key={localDateKey(day)}
                  className="flex min-h-8 flex-1 flex-col gap-0.5 border-r p-1 last:border-r-0"
                >
                  {allDayByDay[days.indexOf(day)].map((event) => (
                    <Badge
                      key={event.id}
                      variant="secondary"
                      className="w-full cursor-pointer justify-start truncate"
                      onClick={() => selectEvent(event)}
                    >
                      <span className="truncate">{event.title}</span>
                    </Badge>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Time grid */}
          <div ref={scrollRef} className="flex max-h-[65vh] overflow-y-auto">
            {/* Hour gutter */}
            <div
              className="relative w-14 shrink-0 border-r bg-muted/10"
              style={{ height: DAY_HEIGHT }}
            >
              {Array.from({ length: 23 }, (_, i) => i + 1).map((hour) => (
                <span
                  key={hour}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground"
                  style={{ top: hour * HOUR_HEIGHT }}
                >
                  {formatTime(new Date(2000, 0, 1, hour))}
                </span>
              ))}
            </div>

            <div
              className="relative flex flex-1"
              style={{ height: DAY_HEIGHT }}
            >
              {/* Hour lines spanning all columns */}
              <div className="pointer-events-none absolute inset-0">
                {Array.from({ length: 23 }, (_, i) => i + 1).map((hour) => (
                  <div
                    key={hour}
                    className="absolute right-0 left-0 border-b border-dashed border-foreground/10 dark:border-muted/60"
                    style={{ top: hour * HOUR_HEIGHT }}
                  />
                ))}
              </div>

              {days.map((day, dayIndex) => (
                <DayColumn
                  key={localDateKey(day)}
                  day={day}
                  dayIndex={dayIndex}
                  segments={segmentsByDay[dayIndex]}
                  onCreateRange={onCreateRange}
                  onSelectEvent={selectEvent}
                  onResize={onResize}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </DndContext>
  )
}

function DayColumn({
  day,
  dayIndex,
  segments,
  onCreateRange,
  onSelectEvent,
  onResize,
}: {
  day: Date
  dayIndex: number
  segments: Array<PositionedSegment>
  onCreateRange: (day: Date, startMin: number, endMin: number) => void
  onSelectEvent: (event: CalendarEvent) => void
  onResize: (commit: ResizeCommit) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { setNodeRef } = useDroppable({ id: `day-${dayIndex}` })
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(
    null,
  )

  function mergedRef(node: HTMLDivElement | null) {
    containerRef.current = node
    setNodeRef(node)
  }

  function minutesFromY(clientY: number): number {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const minutes = ((clientY - rect.top) / rect.height) * MINUTES_PER_DAY
    return snapMinutes(clamp(minutes, 0, MINUTES_PER_DAY))
  }

  // Drag on empty column space sketches a new event (the availability
  // reference's creation gesture); release hands the range to the form.
  function handlePointerDown(pointerEvent: React.PointerEvent) {
    if (pointerEvent.target !== pointerEvent.currentTarget) return
    if (pointerEvent.button !== 0) return
    pointerEvent.preventDefault()
    const anchor = minutesFromY(pointerEvent.clientY)
    let current = anchor

    function handleMove(e: PointerEvent) {
      current = minutesFromY(e.clientY)
      setDraft({
        start: Math.min(anchor, current),
        end: Math.max(anchor, current, anchor + SNAP_MINUTES),
      })
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      setDraft(null)
      const start = Math.min(anchor, current)
      let end = Math.max(anchor, current)
      // A plain click (no drag) creates a default one-hour slot.
      if (end - start < SNAP_MINUTES) end = start + 60
      onCreateRange(day, start, Math.min(end, MINUTES_PER_DAY))
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div
      ref={mergedRef}
      className="relative flex-1 touch-none border-r last:border-r-0"
      onPointerDown={handlePointerDown}
    >
      {segments.map((segment) => (
        <EventBlock
          key={`${segment.event.id}-${segment.startMin}`}
          segment={segment}
          day={day}
          dayIndex={dayIndex}
          onSelect={onSelectEvent}
          onResize={onResize}
        />
      ))}

      {draft && (
        <div
          className="pointer-events-none absolute right-0.5 left-0.5 z-20 rounded border border-primary bg-primary/20"
          style={{
            top: draft.start * MINUTE_HEIGHT,
            height: (draft.end - draft.start) * MINUTE_HEIGHT,
          }}
        >
          <span className="px-1 text-[10px] text-primary">
            {minutesToHHMM(draft.start)} – {minutesToHHMM(draft.end)}
          </span>
        </div>
      )}
    </div>
  )
}

function EventBlock({
  segment,
  day,
  dayIndex,
  onSelect,
  onResize,
}: {
  segment: PositionedSegment
  day: Date
  dayIndex: number
  onSelect: (event: CalendarEvent) => void
  onResize: (commit: ResizeCommit) => void
}) {
  const { event } = segment
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `${event.id}:${dayIndex}`,
      data: { event, dayIndex } satisfies DragData,
    })
  // Local preview while a resize gesture is in flight; cleared on commit.
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(
    null,
  )

  const startMin = preview?.start ?? segment.startMin
  const endMin = preview?.end ?? segment.endMin
  const laneWidth = 100 / segment.laneCount

  function handleResizeStart(
    pointerEvent: React.PointerEvent,
    edge: 'top' | 'bottom',
  ) {
    pointerEvent.stopPropagation()
    pointerEvent.preventDefault()
    const target = pointerEvent.target as HTMLElement
    target.setPointerCapture(pointerEvent.pointerId)
    const initialY = pointerEvent.clientY
    let next = { start: segment.startMin, end: segment.endMin }

    function apply(e: PointerEvent) {
      const deltaMin = snapMinutes((e.clientY - initialY) / MINUTE_HEIGHT)
      if (edge === 'top') {
        const start = clamp(
          segment.startMin + deltaMin,
          0,
          segment.endMin - SNAP_MINUTES,
        )
        next = { start, end: segment.endMin }
      } else {
        const end = clamp(
          segment.endMin + deltaMin,
          segment.startMin + SNAP_MINUTES,
          MINUTES_PER_DAY,
        )
        next = { start: segment.startMin, end }
      }
      setPreview(next)
    }

    function handleUp(e: PointerEvent) {
      target.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', apply)
      window.removeEventListener('pointerup', handleUp)
      setPreview(null)
      const boundary = dateAtMinutes(
        day,
        edge === 'top' ? next.start : next.end,
      )
      if (
        (edge === 'top' && next.start !== segment.startMin) ||
        (edge === 'bottom' && next.end !== segment.endMin)
      ) {
        onResize({ event, edge, boundary })
      }
    }

    window.addEventListener('pointermove', apply)
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group absolute z-10 touch-none overflow-hidden rounded border border-primary/30 bg-primary/15 text-xs shadow-sm',
        isDragging && 'z-40 opacity-90 shadow-lg',
      )}
      style={{
        top: startMin * MINUTE_HEIGHT,
        height: (endMin - startMin) * MINUTE_HEIGHT,
        left: `calc(${segment.lane * laneWidth}% + 2px)`,
        width: `calc(${laneWidth}% - 4px)`,
        transform:
          isDragging && transform
            ? CSS.Translate.toString(transform)
            : undefined,
      }}
    >
      {/* Body: dnd-kit move handle + click-to-open */}
      <div
        className="absolute inset-0 cursor-grab px-1.5 py-1 active:cursor-grabbing"
        {...listeners}
        {...attributes}
        onClick={() => onSelect(event)}
      >
        <p className="truncate font-medium">{event.title}</p>
        {endMin - startMin >= 30 && (
          <p className="truncate text-[10px] text-muted-foreground">
            {formatTime(dateAtMinutes(day, startMin))} –{' '}
            {formatTime(dateAtMinutes(day, endMin))}
          </p>
        )}
      </div>

      {segment.startsHere && (
        <div
          className="absolute top-0 right-0 left-0 z-10 h-1.5 cursor-row-resize group-hover:bg-foreground/10"
          onPointerDown={(e) => handleResizeStart(e, 'top')}
        />
      )}
      {segment.endsHere && (
        <div
          className="absolute right-0 bottom-0 left-0 z-10 h-1.5 cursor-row-resize group-hover:bg-foreground/10"
          onPointerDown={(e) => handleResizeStart(e, 'bottom')}
        />
      )}
    </div>
  )
}
