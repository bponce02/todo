import { createFileRoute } from '@tanstack/react-router'
import { CalendarView } from '../../components/calendar/CalendarView'

export const Route = createFileRoute('/_authenticated/calendar')({
  component: CalendarPage,
})

function CalendarPage() {
  return <CalendarView />
}
