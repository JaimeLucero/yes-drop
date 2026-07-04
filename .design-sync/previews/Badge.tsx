import { Badge } from 'yesdrop'

export function Statuses() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Approved</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="outline">Scheduled</Badge>
      <Badge variant="destructive">Rejected</Badge>
      <Badge variant="ghost">Ignored</Badge>
    </div>
  )
}

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  )
}
