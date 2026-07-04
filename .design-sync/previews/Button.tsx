import { Button } from 'yesdrop'

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Send request</Button>
      <Button variant="outline">Save draft</Button>
      <Button variant="secondary">Schedule</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="link">Learn more</Button>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Send request</Button>
      <Button variant="outline" disabled>
        Save draft
      </Button>
    </div>
  )
}
