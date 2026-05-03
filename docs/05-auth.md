# Authentication

## Frontend: Supabase Auth

### Setup
1. Install: `npm install @supabase/supabase-js @supabase/auth-ui-react`
2. Configure in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### Sign In
```tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Google OAuth
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'http://localhost:3000/dashboard' }
})
```

### Protected Routes
```tsx
const [user, setUser] = useState<User | null>(null)

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => setUser(data.user))
}, [])

if (!user) return <Login />
return <Dashboard />
```

---

## Backend: JWT Validation

### Auth Dependency
```python
from fastapi import Depends, HTTPException, Header
from jose import jwt, JWTError
import httpx

SUPABASE_JWKS_URL = "https://xxx.supabase.co/auth/v1/jwks"

async def get_current_user(authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "")
    
    # Fetch JWKS
    async with httpx.AsyncClient() as client:
        jwks = await client.get(SUPABASE_JWKS_URL)
        jwks = jwks.json()
    
    # Decode token
    try:
        payload = jwt.decode(token, jwks, algorithms=["RS256"])
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid token")
```

### Usage
```python
@router.get("/api/requests")
async def list_requests(user: dict = Depends(get_current_user)):
    user_id = user["sub"]
    # fetch requests for user_id
```