import { useState } from 'react'
import { toast } from 'sonner'
import { CalendarRange, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDeleteEvent } from '../../lib/queries'
import type { CalendarEvent } from '../../lib/events-api'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { formatEventRange } from './calendar-utils'

export function EventDetailDialog({
  event,
  listName,
  isOpen,
  onOpenChange,
  onEdit,
}: {
  event: CalendarEvent | null
  listName?: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (event: CalendarEvent) => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const deleteEvent = useDeleteEvent()

  async function handleDelete() {
    if (!event) return
    try {
      await deleteEvent.mutateAsync(event.id)
      toast.success('Event deleted')
      setConfirmOpen(false)
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not delete the event.',
      )
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[440px]">
          {event && (
            <>
              <DialogHeader>
                <DialogTitle>{event.title}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarRange className="size-4 shrink-0" />
                  {formatEventRange(event)}
                </div>
                {listName && (
                  <div>
                    <Badge variant="secondary">{listName}</Badge>
                  </div>
                )}
                {event.description && (
                  <p className="text-sm whitespace-pre-wrap">
                    {event.description}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 />
                  Delete
                </Button>
                <Button onClick={() => onEdit(event)}>
                  <Pencil />
                  Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sibling of the Dialog, never nested inside it. */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this event?"
        description={`"${event?.title ?? ''}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isPending={deleteEvent.isPending}
      />
    </>
  )
}
