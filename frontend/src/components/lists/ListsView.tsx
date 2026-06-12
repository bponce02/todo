import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowUpDown,
  ListChecks,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { Spinner } from '@/components/ui/spinner'
import { useBulkDeleteLists, useLists, useTasks } from '../../lib/queries'
import type { List } from '../../lib/tasks-api'
import { Fab } from '../common/Fab'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ListCard } from './ListCard'
import { CreateListDialog } from './CreateListDialog'
import { ListSettingsDialog } from './ListSettingsDialog'

type SortKey = 'name' | 'count'

// Shared options so the desktop (labeled) and mobile (icon-only) Sort selects
// stay in sync.
function SortOptions() {
  return (
    <SelectContent>
      <SelectItem value="name">Name</SelectItem>
      <SelectItem value="count">Task count</SelectItem>
    </SelectContent>
  )
}

export function ListsView() {
  const navigate = useNavigate()
  const listsQuery = useLists()
  const tasksQuery = useTasks()
  const lists = listsQuery.data ?? []

  const counts = useMemo(() => {
    const m = new Map<number, number>()
    for (const t of tasksQuery.data ?? [])
      m.set(t.list_id, (m.get(t.list_id) ?? 0) + 1)
    return m
  }, [tasksQuery.data])

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsList, setSettingsList] = useState<List | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const bulkDelete = useBulkDeleteLists()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const result = lists.filter((l) => !q || l.title.toLowerCase().includes(q))
    return [...result].sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
    )
  }, [lists, search, sort, counts])

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

  function openSettings(list: List) {
    setSettingsList(list)
    setSettingsOpen(true)
  }

  async function handleBulkDelete() {
    const ids = [...selected]
    try {
      await bulkDelete.mutateAsync(ids)
      toast.success(`Deleted ${ids.length} list${ids.length === 1 ? '' : 's'}`)
      setBulkDeleteOpen(false)
      exitSelectMode()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not delete lists.',
      )
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Toolbar: full labeled controls on desktop, icon-only on mobile */}
      <div className="flex items-end gap-2 md:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="search-lists">Search</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search-lists"
              className="min-w-0 pr-8 pl-8"
              placeholder="Search lists"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
          <div className="flex w-48 flex-col gap-2">
            <Label>Sort by</Label>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-full" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SortOptions />
            </Select>
          </div>

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
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger
              aria-label="Sort by"
              className="flex size-10 items-center justify-center rounded-3xl p-0 [&>svg:last-child]:hidden"
            >
              <ArrowUpDown className="size-5" />
            </SelectTrigger>
            <SortOptions />
          </Select>

          <Button
            size="icon-lg"
            variant={selectMode ? 'default' : 'secondary'}
            onClick={() =>
              selectMode ? exitSelectMode() : setSelectMode(true)
            }
            aria-label={selectMode ? 'Done selecting' : 'Select lists'}
          >
            <ListChecks />
          </Button>
        </div>
      </div>

      {selectMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
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

      {listsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : listsQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load lists</AlertTitle>
          <AlertDescription>
            {listsQuery.error instanceof Error
              ? listsQuery.error.message
              : 'Please try again.'}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => listsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12">
          <p className="text-muted-foreground">
            {lists.length === 0
              ? 'No lists yet.'
              : 'No lists match your search.'}
          </p>
          {lists.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tap the + button to create one.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              taskCount={counts.get(list.id) ?? 0}
              selectMode={selectMode}
              isSelected={selected.has(list.id)}
              onToggleSelect={toggleSelect}
              onOpen={(l) =>
                navigate({
                  to: '/lists/$listId',
                  params: { listId: String(l.id) },
                })
              }
              onSettings={openSettings}
            />
          ))}
        </div>
      )}

      <Fab label="New list" onPress={() => setCreateOpen(true)} />

      <CreateListDialog isOpen={createOpen} onOpenChange={setCreateOpen} />

      <ListSettingsDialog
        list={settingsList}
        isOpen={settingsOpen}
        onOpenChange={setSettingsOpen}
        onDeleted={() => setSettingsOpen(false)}
      />

      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete selected lists?"
        description={`${selected.size} list${selected.size === 1 ? '' : 's'} and all of their tasks will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
        isPending={bulkDelete.isPending}
      />
    </div>
  )
}
