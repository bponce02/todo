import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDeleteTask } from '../../lib/queries'
import type { Task } from '../../lib/tasks-api'
import { ConfirmDialog } from '../common/ConfirmDialog'

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD; anchor to local midnight to avoid timezone drift.
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

export function TaskDetailDialog({
  task,
  listName,
  isOpen,
  onOpenChange,
  onEdit,
  onDeleted,
}: {
  task: Task | null
  listName?: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (task: Task) => void
  onDeleted: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const deleteTask = useDeleteTask()

  async function handleDelete() {
    if (!task) return
    try {
      await deleteTask.mutateAsync(task.id)
      toast.success('Task deleted')
      setConfirmOpen(false)
      onDeleted()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not delete the task.',
      )
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{task?.title}</DialogTitle>
          </DialogHeader>
          {task && (
            <div className="flex flex-col gap-4">
              {task.description && (
                <Field label="Description">
                  <p>{task.description}</p>
                </Field>
              )}
              <Field label="Due date">
                <p
                  className={
                    task.due_date ? undefined : 'text-muted-foreground'
                  }
                >
                  {task.due_date ? formatDate(task.due_date) : 'No due date'}
                </p>
              </Field>
              <Field label="List">
                <div>
                  <Badge variant="secondary">{listName ?? 'Unknown'}</Badge>
                </div>
              </Field>
              <Field label="Status">
                <div>
                  <Badge variant={task.completed ? 'default' : 'secondary'}>
                    {task.completed ? 'Completed' : 'Active'}
                  </Badge>
                </div>
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => task && onEdit(task)}>
              <Pencil />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete task?"
        description={`"${task?.title}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isPending={deleteTask.isPending}
      />
    </>
  )
}
