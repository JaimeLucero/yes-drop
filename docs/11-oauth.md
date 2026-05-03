# OAuth Implementation

This document covers the OAuth 2.0 implementation for YesDrop using Supabase as the authentication provider.

## Overview

YesDrop uses Supabase's built-in OAuth 2.0 authentication with Google as the identity provider. The flow is:

1. **Frontend (Next.js)** → User clicks "Sign in with Google"
2. **Supabase OAuth** → Redirects to Google, user authenticates
3. **Callback** → Supabase redirects back with session/token
4. **Frontend stores session** → Token is stored in browser
5. **Backend validates** → Each API request includes JWT, backend verifies signature

## Frontend OAuth Flow

### Setup

The frontend uses Supabase client library for OAuth:

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  
  if (data?.url) window.location.href = data.url
  if (error) throw error
}
```

### Environment Variables

Frontend requires Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### OAuth Callback

After Google authentication, user is redirected to `/auth/callback`:

```typescript
// src/app/auth/callback/page.tsx
export default function AuthCallbackPage() {
  useEffect(() => {
    // Supabase client automatically handles the callback
    // Session is established
    router.push('/dashboard')
  }, [])
}
```

### Getting the Token

Once authenticated, the frontend can get the JWT:

```typescript
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token
```

## Backend JWT Validation

### Architecture

The backend validates JWT tokens from the frontend using the JWKS (JSON Web Key Set) from Supabase.

```
Frontend Request
    ↓
Authorization Header (Bearer token)
    ↓
Backend: get_current_user()
    ↓
Fetch JWKS from Supabase
    ↓
Find key by kid (key ID)
    ↓
Validate JWT signature (ES256)
    ↓
Check audience & issuer claims
    ↓
Extract user_id from token
    ↓
Return user_id (authenticated)
```

### Configuration

Backend requires Supabase auth configuration:

```env
# .env.local
SUPABASE_JWKS_URL=https://[your-project-id].supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_AUDIENCE=authenticated
```

### Token Structure

Supabase generates ES256-signed JWTs with the following claims:

```json
{
  "aud": "authenticated",
  "iss": "https://[your-project-id].supabase.co/auth/v1",
  "sub": "user-uuid-here",
  "iat": 1234567890,
  "exp": 1234571490
}
```

Key points:
- **Algorithm**: ES256 (Elliptic Curve, not RSA)
- **Audience**: `"authenticated"` (not the project URL)
- **Issuer**: Full auth URL with `/auth/v1` path
- **Subject**: The user's UUID

### Validation Process

```python
# main.py

async def get_current_user(authorization: str = Header()):
    # 1. Extract token from "Bearer <token>" header
    token = authorization[7:]
    
    # 2. Fetch JWKS (cached after first request)
    jwks = await get_jwks()
    
    # 3. Get token header to find kid (key ID)
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    
    # 4. Find the matching key from JWKS
    key_data = [k for k in jwks["keys"] if k["kid"] == kid][0]
    
    # 5. Construct cryptographic key from JWK
    key = jwk.construct(key_data)
    
    # 6. Verify signature and claims
    payload = jwt.decode(
        token,
        key,
        algorithms=["ES256"],  # Must match token's alg
        audience="authenticated",
        issuer="https://[your-project-id].supabase.co/auth/v1",
    )
    
    # 7. Return authenticated user ID
    return payload.get("sub")
```

### CORS Configuration

The backend allows requests from frontend domains:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Debugging Token Issues

### Common Errors

#### 1. "SUPABASE_JWKS_URL not configured"
- **Cause**: Environment variable not loaded
- **Fix**: Ensure `.env.local` exists with correct JWKS URL
- **Check**: `echo $SUPABASE_JWKS_URL`

#### 2. "Invalid token" / 401 Unauthorized
- **Cause**: Token signature verification failed
- **Fix**: Verify JWKS URL returns valid keys
- **Check**: `curl https://[your-project-id].supabase.co/auth/v1/.well-known/jwks.json`

#### 3. "The specified alg value is not allowed"
- **Cause**: Token uses different algorithm (ES256 vs RS256)
- **Fix**: Update backend to accept `["ES256"]` not `["RS256"]`
- **Debug**: Check logs for actual token algorithm

#### 4. "Invalid audience"
- **Cause**: Token's `aud` claim doesn't match expected value
- **Fix**: Token has `aud: "authenticated"`, not project URL
- **Debug**: Log token payload with `jwt.get_unverified_claims(token)`

#### 5. "Invalid issuer"
- **Cause**: Token's `iss` claim doesn't match expected value
- **Fix**: Must be `https://[project].supabase.co/auth/v1`, includes `/auth/v1` path
- **Debug**: Log token payload to verify issuer

### Enabling Debug Logging

Backend logs all OAuth validation steps:

```python
logging.basicConfig(
    level=logging.DEBUG,  # Shows all debug messages
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

Key log messages:
- `Validating token` - Token processing started
- `Fetching JWKS from [URL]` - JWKS endpoint request
- `Successfully fetched JWKS with X keys` - JWKS loaded
- `Token kid: [value], alg: [ES256|RS256]` - Token header info
- `Token payload aud: [value], iss: [value]` - Token claims
- `Decoding token with audience: [value], issuer: [value]` - Validation params
- `Token validated for user: [uuid]` - Success
- `JWT validation failed: [error]` - Signature/claim validation error

### Testing the Flow

1. **Frontend**: Sign in via Google
2. **Check token**: 
   ```typescript
   const { data: { session } } = await supabase.auth.getSession()
   console.log(session?.access_token)
   ```
3. **Backend logs**: Watch for token validation messages
4. **API requests**: Verify `Authorization: Bearer [token]` header is sent
5. **Response**: Should receive 200 with data, not 401

## Security Considerations

1. **JWKS Caching**: Keys are fetched once and cached in memory for performance
2. **Token Expiration**: Tokens expire (typically 1 hour), frontend must refresh
3. **CORS**: Restricted to specific frontend domains in production
4. **HTTPS Only**: In production, ensure all OAuth URLs use HTTPS
5. **Audience Validation**: Prevents tokens from other apps being accepted

## Production Checklist

- [ ] Update CORS allowed origins to production domain
- [ ] Verify SUPABASE_JWKS_URL points to production project
- [ ] Ensure SUPABASE_AUDIENCE matches production settings
- [ ] Enable HTTPS on all OAuth URLs
- [ ] Set up token refresh mechanism for long sessions
- [ ] Configure backend to handle token expiration gracefully
- [ ] Monitor OAuth error logs in production
- [ ] Test full OAuth flow in staging environment

## References

- [Supabase OAuth Documentation](https://supabase.com/docs/guides/auth/oauth2)
- [JWT.io - JWT Debugger](https://jwt.io/) - Useful for inspecting token claims
- [python-jose Library](https://github.com/mpdavis/python-jose) - Backend JWT handling
- [Supabase Auth API](https://supabase.com/docs/reference/auth/introduction)
