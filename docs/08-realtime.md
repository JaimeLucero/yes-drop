# Real-time Updates

## Frontend: TanStack Query Polling

### Setup
```bash
npm install @tanstack/react-query
```

### Query Client Setup
```tsx
// app/layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

### Dashboard Polling
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!

function Dashboard() {
  const queryClient = useQueryClient()
  
  // Fetch with polling every 5 seconds
  const { data: requests } = useQuery({
    queryKey: ['requests'],
    queryFn: async () => {
      const token = await getSupabaseToken()
      const res = await fetch(`${BACKEND_URL}/api/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return res.json()
    },
    refetchInterval: 5000  // Poll every 5 seconds
  })
  
  // Create mutation
  const createRequest = useMutation({
    mutationFn: async (data) => {
      const token = await getSupabaseToken()
      const res = await fetch(`${BACKEND_URL}/api/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    }
  })
  
  return (
    <div>
      {requests?.map(req => (
        <Card key={req.id}>
          <Badge variant={req.status === 'pending' ? 'yellow' : req.status === 'approved' ? 'green' : 'red'}>
            {req.status}
          </Badge>
        </Card>
      ))}
    </div>
  )
}
```

### Why Polling Instead of WebSockets

- Simpler to implement
- Works reliably
- 5 second interval feels "instant enough"
- No extra infrastructure