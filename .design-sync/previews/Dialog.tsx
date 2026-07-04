import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from 'yesdrop'

export function SendApproval() {
  return (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send approval request</DialogTitle>
          <DialogDescription>
            The approver gets an email with Approve and Reject buttons — no account needed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
