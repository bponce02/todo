import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { useDeleteList, useRenameList } from '../../lib/queries'
import type { List } from '../../lib/tasks-api'
import { ConfirmDialog } from '../common/ConfirmDialog'

export function ListSettingsDialog({
  list,
  isOpen,
  onOpenChange,
  onDeleted,
}: {
  list: List | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const [title, setTitle] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const rename = useRenameList()
  const deleteList = useDeleteList()

  useEffect(() => {
    if (isOpen && list) setTitle(list.title)
  }, [isOpen, list])

  const trimmed = title.trim()
  const canRename = trimmed.length > 0 && trimmed !== list?.title

  async function handleRename() {
    if (!list || !canRename) return
    try {
      await rename.mutateAsync({ id: list.id, title: trimmed })
      toast.success('List renamed')
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not rename the list.',
      )
    }
  }

  async function handleDelete() {
    if (!list) return
    try {
      await deleteList.mutateAsync(list.id)
      toast.success('List deleted')
      setConfirmOpen(false)
      onDeleted()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not delete the list.',
      )
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>List settings</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="list-settings-name">Name</Label>
                <Input
                  id="list-settings-name"
                  placeholder="List name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!canRename || rename.isPending}
                  onClick={handleRename}
                >
                  {rename.isPending ? <Spinner /> : null}
                  Rename
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-medium">Delete list</span>
                <p className="text-sm text-muted-foreground">
                  Removes the list and all of its tasks.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 />
                Delete
              </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete list?"
        description={`"${list?.title}" and all of its tasks will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete list"
        onConfirm={handleDelete}
        isPending={deleteList.isPending}
      />
    </>
  )
}
