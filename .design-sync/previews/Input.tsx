import { Input } from 'yesdrop'

export function Default() {
  return (
    <div className="w-72">
      <Input placeholder="approver@company.com" />
    </div>
  )
}

export function Filled() {
  return (
    <div className="w-72">
      <Input defaultValue="Q3 marketing budget" />
    </div>
  )
}

export function Disabled() {
  return (
    <div className="w-72">
      <Input placeholder="approver@company.com" disabled />
    </div>
  )
}

export function Invalid() {
  return (
    <div className="w-72">
      <Input defaultValue="not-an-email" aria-invalid />
    </div>
  )
}
