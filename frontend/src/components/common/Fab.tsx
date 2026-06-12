import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

// Floating action button fixed to the bottom-right corner. Sits above page
// content and clears the mobile bottom tab bar (which is centered).
export function Fab({
  label,
  onPress,
  icon,
}: {
  label: string
  onPress: () => void
  icon?: ReactNode
}) {
  return (
    <Button
      aria-label={label}
      onClick={onPress}
      className="fixed bottom-24 right-5 z-40 size-14 rounded-full shadow-lg md:bottom-6 [&_svg:not([class*='size-'])]:size-6"
    >
      {icon ?? <Plus />}
    </Button>
  )
}
