import { Calendar } from 'yesdrop'

export function Default() {
  return (
    <div className="w-fit rounded-xl ring-1 ring-foreground/10">
      <Calendar mode="single" defaultMonth={new Date(2026, 6, 1)} selected={new Date(2026, 6, 10)} />
    </div>
  )
}
