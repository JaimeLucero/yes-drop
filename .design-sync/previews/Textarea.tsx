import { Textarea } from 'yesdrop'

export function Default() {
  return (
    <div className="w-80">
      <Textarea placeholder="Add context to help the approver decide…" />
    </div>
  )
}

export function Filled() {
  return (
    <div className="w-80">
      <Textarea defaultValue="Requesting sign-off on the Q3 marketing spend. Full breakdown attached — respond by Friday." />
    </div>
  )
}

export function Disabled() {
  return (
    <div className="w-80">
      <Textarea placeholder="Add context…" disabled />
    </div>
  )
}
