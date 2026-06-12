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
import { Textarea } from '@/components/ui/textarea'
import { useCreateTask, useUpdateTask } from '../../lib/queries'
import { firstError, taskFormSchema } from '../../lib/schemas'
import type { TaskFormValues } from '../../lib/schemas'
import type { List, Task } from '../../lib/tasks-api'
import { DueDatePicker } from '../common/DueDatePicker'

export function TaskFormDrawer({
  isOpen,
  onOpenChange,
  task,
  lists,
  defaultListId,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  task?: Task
  lists: Array<List>
  defaultListId?: number
}) {
  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        {isOpen && (
          <TaskFormContents
            key={task?.id ?? 'new'}
            task={task}
            lists={lists}
            defaultListId={defaultListId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}

function TaskFormContents({
  task,
  lists,
  defaultListId,
  onClose,
}: {
  task?: Task
  lists: Array<List>
  defaultListId?: number
  onClose: () => void
}) {
  const isEdit = Boolean(task)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  // Annotated as TaskFormValues so optional fields stay optional in the form
  // type (list_id can be undefined when no lists exist yet -- the create hook
  // auto-creates a default list).
  const defaults: TaskFormValues = {
    title: task?.title ?? '',
    description: task?.description ?? '',
    due_date: task?.due_date ?? '',
    list_id: task?.list_id ?? defaultListId ?? lists.at(0)?.id,
  }

  const form = useForm({
    defaultValues: defaults,
    validators: { onChange: taskFormSchema },
    onSubmit: async ({ value }) => {
      try {
        if (task) {
          await updateTask.mutateAsync({
            id: task.id,
            patch: {
              title: value.title,
              description: value.description || null,
              due_date: value.due_date || null,
              list_id: value.list_id,
            },
          })
          toast.success('Task updated')
        } else {
          await createTask.mutateAsync({
            title: value.title,
            description: value.description,
            due_date: value.due_date,
            list_id: value.list_id,
          })
          toast.success('Task created')
        }
        onClose()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not save the task.',
        )
      }
    },
  })

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{isEdit ? 'Edit task' : 'New task'}</DrawerTitle>
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
                  <Label htmlFor="task-form-title">Title</Label>
                  <Input
                    id="task-form-title"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={hasErrors}
                    placeholder="What needs doing?"
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

          <form.Field name="description">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-form-description">Description</Label>
                <Textarea
                  id="task-form-description"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Add more detail (optional)"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="due_date">
            {(field) => (
              <DueDatePicker
                value={field.state.value || undefined}
                onChange={(v) => field.handleChange(v ?? '')}
              />
            )}
          </form.Field>

          <form.Field name="list_id">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-form-list">List</Label>
                <Select
                  value={
                    field.state.value != null ? String(field.state.value) : ''
                  }
                  onValueChange={(key) =>
                    field.handleChange(key ? Number(key) : undefined)
                  }
                >
                  <SelectTrigger
                    id="task-form-list"
                    className="w-full"
                    aria-invalid={field.state.meta.errors.length > 0}
                  >
                    <SelectValue placeholder="Select a list" />
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
                    A default list will be created.
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
                  {isEdit ? 'Save changes' : 'Create task'}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </div>
    </>
  )
}
