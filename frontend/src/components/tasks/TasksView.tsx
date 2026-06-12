import { useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'
import {
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  Copy,
  Filter,
  List as ListIcon,
  ListChecks,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  useBulkDeleteTasks,
  useBulkDuplicateTasks,
  useBulkUpdateTasks,
  useLists,
  useTasks,
  useUpdateTask,
} from '../../lib/queries'
import type { List, Task } from '../../lib/tasks-api'
import { Fab } from '../common/Fab'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { TaskCard } from './TaskCard'
import { TaskDetailDialog } from './TaskDetailDialog'
import { TaskFormDrawer } from './TaskFormDrawer'

type StatusFilter = 'all' | 'active' | 'completed'

// Shared option lists so the desktop (labeled) and mobile (icon-only) Selects
// stay in sync.
function StatusOptions() {
  return (
    <>
      <SelectItem value="all">All</SelectItem>
      <SelectItem value="active">Active</SelectItem>
      <SelectItem value="completed">Completed</SelectItem>
    </>
  )
}

function ListOptions({ lists }: { lists: Array<List> }) {
  return (
    <>
      <SelectItem value="all">All lists</SelectItem>
      {lists.map((list) => (
        <SelectItem key={list.id} value={String(list.id)}>
          {list.title}
        </SelectItem>
      ))}
    </>
  )
}

export function TasksView({ listId }: { listId?: number }) {
  const listsQuery = useLists()
  const tasksQuery = useTasks(listId)
  const lists = listsQuery.data ?? []
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [listFilter, setListFilter] = useState<string>('all')

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const [togglingId, setTogglingId] = useState<number | null>(null)
  const updateTask = useUpdateTask()

  function fireConfetti() {
    confetti({
      particleCount: 120,
      spread: 160,
      startVelocity: 30,
      gravity: 0.8,
      origin: { x: 0.5, y: 0 },
      zIndex: 9999,
    })
  }

  const bulkUpdate = useBulkUpdateTasks()
  const bulkDelete = useBulkDeleteTasks()
  const bulkDuplicate = useBulkDuplicateTasks()

  const tasks = tasksQuery.data ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (status === 'active' && t.completed) return false
      if (status === 'completed' && !t.completed) return false
      if (!listId && listFilter !== 'all' && t.list_id !== Number(listFilter))
        return false
      if (q) {
        const hay = `${t.title} ${t.description ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tasks, search, status, listFilter, listId])

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function handleToggleComplete(task: Task) {
    if (!task.completed) fireConfetti()
    setTogglingId(task.id)
    try {
      await updateTask.mutateAsync({
        id: task.id,
        patch: { completed: !task.completed },
      })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not update the task.',
      )
    } finally {
      setTogglingId(null)
    }
  }

  async function handleBulkComplete() {
    const ids = [...selected]
    try {
      await bulkUpdate.mutateAsync({ ids, patch: { completed: true } })
      toast.success(
        `Marked ${ids.length} task${ids.length === 1 ? '' : 's'} complete`,
      )
      exitSelectMode()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not update tasks.',
      )
    }
  }

  async function handleBulkDuplicate() {
    const sourceTasks = tasks.filter((t) => selected.has(t.id))
    try {
      await bulkDuplicate.mutateAsync(sourceTasks)
      toast.success(
        `Duplicated ${sourceTasks.length} task${sourceTasks.length === 1 ? '' : 's'}`,
      )
      exitSelectMode()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not duplicate tasks.',
      )
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected]
    try {
      await bulkDelete.mutateAsync(ids)
      toast.success(`Deleted ${ids.length} task${ids.length === 1 ? '' : 's'}`)
      setBulkDeleteOpen(false)
      exitSelectMode()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not delete tasks.',
      )
    }
  }

  function openCreate() {
    setEditingTask(undefined)
    setDrawerOpen(true)
  }

  function openDetail(task: Task) {
    setDetailTask(task)
    setDetailOpen(true)
  }

  function openEdit(task: Task) {
    setDetailOpen(false)
    setEditingTask(task)
    setDrawerOpen(true)
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Toolbar: full labeled controls on desktop, icon-only on mobile */}
      <div className="flex items-end gap-2 md:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="task-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="task-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tasks"
              placeholder="Search title or description"
              className="min-w-0 pr-8 pl-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop controls */}
        <div className="hidden shrink-0 items-end gap-3 md:flex">
          <div className="flex w-44 flex-col gap-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select
              value={status}
              onValueChange={(key) => setStatus(key as StatusFilter)}
            >
              <SelectTrigger id="status-filter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <StatusOptions />
              </SelectContent>
            </Select>
          </div>

          {!listId && (
            <div className="flex w-48 flex-col gap-2">
              <Label htmlFor="list-filter">List</Label>
              <Select
                value={listFilter}
                onValueChange={(key) => setListFilter(key)}
              >
                <SelectTrigger id="list-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <ListOptions lists={lists} />
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            variant={selectMode ? 'default' : 'secondary'}
            onClick={() =>
              selectMode ? exitSelectMode() : setSelectMode(true)
            }
          >
            <ListChecks />
            {selectMode ? 'Done' : 'Select'}
          </Button>
        </div>

        {/* Mobile controls: icon-only, aligned with the search bar */}
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <Select
            value={status}
            onValueChange={(key) => setStatus(key as StatusFilter)}
          >
            <SelectTrigger
              aria-label="Filter by status"
              className="size-10 justify-center rounded-full p-0 [&>svg:last-child]:hidden"
            >
              <Filter className="size-5" />
            </SelectTrigger>
            <SelectContent>
              <StatusOptions />
            </SelectContent>
          </Select>

          {!listId && (
            <Select
              value={listFilter}
              onValueChange={(key) => setListFilter(key)}
            >
              <SelectTrigger
                aria-label="Filter by list"
                className="size-10 justify-center rounded-full p-0 [&>svg:last-child]:hidden"
              >
                <ListIcon className="size-5" />
              </SelectTrigger>
              <SelectContent>
                <ListOptions lists={lists} />
              </SelectContent>
            </Select>
          )}

          <Button
            size="icon"
            variant={selectMode ? 'default' : 'secondary'}
            onClick={() =>
              selectMode ? exitSelectMode() : setSelectMode(true)
            }
            aria-label={selectMode ? 'Done selecting' : 'Select tasks'}
          >
            <ListChecks />
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={selected.size === 0 || bulkUpdate.isPending}
              onClick={handleBulkComplete}
            >
              {bulkUpdate.isPending ? <Spinner /> : <CheckCheck />}
              Mark complete
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={selected.size === 0 || bulkDuplicate.isPending}
              onClick={handleBulkDuplicate}
            >
              {bulkDuplicate.isPending ? <Spinner /> : <Copy />}
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={selected.size === 0 || bulkDelete.isPending}
              onClick={() => setBulkDeleteOpen(true)}
            >
              {bulkDelete.isPending ? <Spinner /> : <Trash2 />}
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={exitSelectMode}>
              <X />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {tasksQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : tasksQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load tasks</AlertTitle>
          <AlertDescription>
            {tasksQuery.error instanceof Error
              ? tasksQuery.error.message
              : 'Please try again.'}
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => tasksQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12">
          <p className="text-muted-foreground">
            {tasks.length === 0
              ? 'No tasks yet.'
              : 'No tasks match your filters.'}
          </p>
          {tasks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tap the + button to create one.
            </p>
          )}
        </div>
      ) : (
        (() => {
          const active = filtered.filter((t) => !t.completed)
          const completed = filtered.filter((t) => t.completed)
          const renderCard = (task: Task) => (
            <TaskCard
              key={task.id}
              task={task}
              listName={listById.get(task.list_id)?.title}
              selectMode={selectMode}
              isSelected={selected.has(task.id)}
              isToggling={togglingId === task.id}
              onToggleSelect={toggleSelect}
              onToggleComplete={handleToggleComplete}
              onOpen={openDetail}
            />
          )
          return (
            <div className="flex flex-col gap-3">
              {active.map(renderCard)}
              {active.length > 0 && completed.length > 0 && (
                <div className="flex items-center gap-3 py-1">
                  <Separator className="flex-1" />
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="size-3.5" />
                    <span className="text-sm text-muted-foreground">
                      Completed
                    </span>
                  </div>
                  <Separator className="flex-1" />
                </div>
              )}
              {completed.map(renderCard)}
            </div>
          )
        })()
      )}

      <Fab label="New task" onPress={openCreate} />

      <TaskFormDrawer
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        task={editingTask}
        lists={lists}
        defaultListId={listId}
      />

      <TaskDetailDialog
        task={detailTask}
        listName={
          detailTask ? listById.get(detailTask.list_id)?.title : undefined
        }
        isOpen={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onDeleted={() => setDetailOpen(false)}
      />

      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete selected tasks?"
        description={`${selected.size} task${selected.size === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
        isPending={bulkDelete.isPending}
      />
    </div>
  )
}
