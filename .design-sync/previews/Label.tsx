import { Label, Input, Textarea } from 'yesdrop'

export function WithInput() {
  return (
    <div className="grid w-72 gap-2">
      <Label htmlFor="approver">Approver email</Label>
      <Input id="approver" placeholder="approver@company.com" />
    </div>
  )
}

export function WithTextarea() {
  return (
    <div className="grid w-72 gap-2">
      <Label htmlFor="message">Message</Label>
      <Textarea id="message" placeholder="Add context for the approver…" />
    </div>
  )
}
