import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useCreateList } from '../../lib/queries'
import { firstError, listFormSchema } from '../../lib/schemas'

export function CreateListDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New list</DialogTitle>
        </DialogHeader>
        {isOpen && <CreateListForm onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CreateListForm({ onClose }: { onClose: () => void }) {
  const createList = useCreateList()

  const form = useForm({
    defaultValues: { title: '' },
    validators: { onChange: listFormSchema },
    onSubmit: async ({ value }) => {
      try {
        await createList.mutateAsync(value.title)
        toast.success('List created')
        onClose()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not create the list.',
        )
      }
    },
  })

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.Field name="title">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-list-title">List title</Label>
            <Input
              id="create-list-title"
              placeholder="e.g. Groceries"
              autoFocus
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-sm text-destructive">
                {firstError(field.state.meta.errors)}
              </p>
            )}
          </div>
        )}
      </form.Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <form.Subscribe
          selector={(s) => ({
            canSubmit: s.canSubmit,
            isSubmitting: s.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Create
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
