import { MousePointerClick } from 'lucide-react'

/** Detail-pane empty state for a specific folder when nothing is selected. */
export function DetailPlaceholder({ label }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-xs">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <MousePointerClick className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Select a request</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose {label ? `a ${label.toLowerCase()} request` : 'a request'} from the list to see its details.
        </p>
      </div>
    </div>
  )
}
