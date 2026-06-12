import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import type { Task } from '../../lib/tasks-api'

export function TaskCard({
  task,
  listName,
  selectMode,
  isSelected,
  isToggling,
  onToggleSelect,
  onToggleComplete,
  onOpen,
}: {
  task: Task
  listName?: string
  selectMode: boolean
  isSelected: boolean
  isToggling: boolean
  onToggleSelect: (id: number) => void
  onToggleComplete: (task: Task) => void
  onOpen: (task: Task) => void
}) {
  const activate = () => (selectMode ? onToggleSelect(task.id) : onOpen(task))

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      className="cursor-pointer"
    >
      <Card className="p-4">
        <div className="flex items-center gap-3">
          {selectMode && (
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(task.id)}
                aria-label={`Select ${task.title}`}
              />
            </div>
          )}

          <div className="flex flex-1 flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'truncate font-medium',
                  task.completed && 'text-muted-foreground',
                )}
              >
                {task.title}
              </span>
              {listName && (
                <Badge variant="secondary" className="shrink-0">
                  {listName}
                </Badge>
              )}
            </div>

            <p className="line-clamp-1 min-h-[1lh] text-muted-foreground">
              {task.description ?? ''}
            </p>
          </div>

          {!selectMode && (
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                size="icon-sm"
                variant={task.completed ? 'default' : 'outline'}
                disabled={isToggling}
                onClick={() => onToggleComplete(task)}
                aria-label={
                  task.completed ? 'Mark incomplete' : 'Mark complete'
                }
              >
                {isToggling ? <Spinner /> : <Check />}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
