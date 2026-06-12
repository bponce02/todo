import type { CalendarEvent } from '../../lib/events-api'

// Grid geometry: a fixed pixel scale keeps every minutes<->pixels conversion
// trivial (the availability reference used %-of-container instead).
export const HOUR_HEIGHT = 48
export const DAY_HEIGHT = HOUR_HEIGHT * 24
export const MINUTE_HEIGHT = HOUR_HEIGHT / 60
export const SNAP_MINUTES = 15
export const MINUTES_PER_DAY = 24 * 60

export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
  )
}

// Local YYYY-MM-DD key (not toISOString, which would shift across UTC).
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function minutesToHHMM(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

// Build the local Date at `minutes` past midnight of `day`.
export function dateAtMinutes(day: Date, minutes: number): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
  )
}

// Compose a YYYY-MM-DD + HH:mm local pair into a UTC ISO string for the API.
export function composeIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi).toISOString()
}

// All-day events carry date-only semantics in their UTC date components
// (stored as midnight UTC); read the date straight off the string so the
// local timezone can't shift the day.
export function allDayDateKey(iso: string): string {
  return iso.slice(0, 10)
}

export function isAllDayOn(event: CalendarEvent, day: Date): boolean {
  const key = localDateKey(day)
  return allDayDateKey(event.start) <= key && key <= allDayDateKey(event.end)
}

// A timed event clipped to one day column. Multi-day events produce one
// segment per day they overlap.
export interface DaySegment {
  event: CalendarEvent
  startMin: number
  endMin: number
  // Whether the real event boundary falls inside this day (controls which
  // resize handles are shown and where the time label comes from).
  startsHere: boolean
  endsHere: boolean
}

export function timedSegmentsForDay(
  events: Array<CalendarEvent>,
  day: Date,
): Array<DaySegment> {
  const dayStart = startOfLocalDay(day)
  const dayEnd = addDays(dayStart, 1)
  const segments: Array<DaySegment> = []
  for (const event of events) {
    if (event.all_day) continue
    const start = new Date(event.start)
    const end = new Date(event.end)
    if (end <= dayStart || start >= dayEnd) continue
    const segStart = start < dayStart ? dayStart : start
    const segEnd = end > dayEnd ? dayEnd : end
    const startMin = (segStart.getTime() - dayStart.getTime()) / 60000
    let endMin = (segEnd.getTime() - dayStart.getTime()) / 60000
    // Zero-length events still get a visible, clickable block.
    if (endMin - startMin < SNAP_MINUTES) {
      endMin = Math.min(startMin + SNAP_MINUTES, MINUTES_PER_DAY)
    }
    segments.push({
      event,
      startMin,
      endMin,
      startsHere: start >= dayStart,
      endsHere: end <= dayEnd,
    })
  }
  return segments
}

export interface PositionedSegment extends DaySegment {
  lane: number
  laneCount: number
}

// Greedy lane assignment so overlapping events share the column width
// (real calendars allow overlap; the availability reference forbade it).
// Segments are grouped into clusters of transitive overlap; each cluster's
// segments split the width evenly by lane.
export function layoutSegments(
  segments: Array<DaySegment>,
): Array<PositionedSegment> {
  const sorted = [...segments].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin,
  )
  const result: Array<PositionedSegment> = []
  let cluster: Array<PositionedSegment> = []
  let laneEnds: Array<number> = []
  let clusterEnd = 0

  function flushCluster() {
    for (const seg of cluster) seg.laneCount = laneEnds.length
    cluster = []
    laneEnds = []
  }

  for (const seg of sorted) {
    if (cluster.length > 0 && seg.startMin >= clusterEnd) flushCluster()
    let lane = laneEnds.findIndex((end) => end <= seg.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(seg.endMin)
    } else {
      laneEnds[lane] = seg.endMin
    }
    const positioned: PositionedSegment = { ...seg, lane, laneCount: 0 }
    cluster.push(positioned)
    result.push(positioned)
    clusterEnd = Math.max(clusterEnd, seg.endMin)
  }
  flushCluster()
  return result
}

// ---- Formatting ----

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})
const dateOnlyFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC', // all-day dates are date-only; don't shift them locally
})

export function formatTime(date: Date): string {
  return timeFormat.format(date)
}

export function formatEventRange(event: CalendarEvent): string {
  if (event.all_day) {
    const start = dateOnlyFormat.format(new Date(event.start))
    const end = dateOnlyFormat.format(new Date(event.end))
    return start === end ? `All day · ${start}` : `All day · ${start} – ${end}`
  }
  const start = new Date(event.start)
  const end = new Date(event.end)
  if (localDateKey(start) === localDateKey(end)) {
    return `${dayFormat.format(start)} · ${timeFormat.format(start)} – ${timeFormat.format(end)}`
  }
  return `${dayFormat.format(start)}, ${timeFormat.format(start)} – ${dayFormat.format(end)}, ${timeFormat.format(end)}`
}
