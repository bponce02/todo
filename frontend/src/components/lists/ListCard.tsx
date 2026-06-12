import { Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { List } from '../../lib/tasks-api'

export function ListCard({
  list,
  taskCount,
  selectMode,
  isSelected,
  onToggleSelect,
  onOpen,
  onSettings,
}: {
  list: List
  taskCount: number
  selectMode: boolean
  isSelected: boolean
  onToggleSelect: (id: number) => void
  onOpen: (list: List) => void
  onSettings: (list: List) => void
}) {
  const activate = () => (selectMode ? onToggleSelect(list.id) : onOpen(list))

  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 px-4">
        {selectMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(list.id)}
            aria-label={`Select ${list.title}`}
          />
        )}

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
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span className="font-medium">{list.title}</span>
          <Badge variant="secondary">{taskCount}</Badge>
        </div>

        {!selectMode && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onSettings(list)}
            aria-label={`Settings for ${list.title}`}
          >
            <Settings />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
