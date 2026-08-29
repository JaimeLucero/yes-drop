import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from 'yesdrop'

export function ApprovalRequest() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Q3 marketing budget</CardTitle>
        <CardDescription>Requested sign-off from cfo@acme.com</CardDescription>
        <CardAction>
          <Badge variant="secondary">Pending</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        Requesting approval on the Q3 marketing spend. Breakdown attached. Respond by Friday.
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm">
          Reject
        </Button>
        <Button size="sm">Approve</Button>
      </CardFooter>
    </Card>
  )
}

export function Simple() {
  return (
    <Card className="w-72">
      <CardHeader>
        <CardTitle>Reminders on autopilot</CardTitle>
        <CardDescription>Scheduled follow-ups nudge non-responders until the deadline.</CardDescription>
      </CardHeader>
    </Card>
  )
}
