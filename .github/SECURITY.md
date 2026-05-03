# Security Guidelines

This document outlines the security practices for YesDrop to prevent accidental credential exposure.

## Protecting Credentials

### Never Commit
- `.env` files
- `.env.local` files
- API keys or tokens
- Database passwords
- Private keys

### Use Placeholders in Documentation
When documenting configuration, use placeholders instead of real values:

❌ **Wrong:**
```env
SUPABASE_URL=https://abcdefghijkl.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ **Right:**
```env
SUPABASE_URL=https://[your-project-id].supabase.co
SUPABASE_KEY=[your-anon-key]
```

## Security Scanning

### GitHub Actions CI/CD
Every push and pull request is automatically scanned for:

1. **Gitleaks** - Detects secrets in git history
2. **Environment Files** - Ensures .env files are not committed
3. **API Key Patterns** - Scans for known credential formats
4. **JWT Tokens** - Detects leaked authentication tokens
5. **Documentation Scan** - Ensures docs don't contain real credentials

If any issues are detected, the build will **fail** and prevent merging.

### Local Pre-commit Hooks
To catch issues **before** pushing, set up pre-commit hooks:

```bash
# Install pre-commit
pip install pre-commit

# Install the git hooks
pre-commit install

# (Optional) Test the hooks on all files
pre-commit run --all-files
```

Once installed, the hooks run automatically on every commit and will:
- Block commits with .env files
- Detect credential patterns
- Scan docs for exposed secrets

### Manual Scanning
Run gitleaks locally to scan your changes:

```bash
# Install gitleaks (macOS)
brew install gitleaks

# Scan your changes
gitleaks detect --verbose --redact

# Scan specific directory
gitleaks detect --source ./backend --verbose
```

## Incident Response

### If You Accidentally Committed Credentials

1. **Stop** - Don't push the commit yet
2. **Revert** - `git reset --soft HEAD~1`
3. **Remove** - Delete the credential
4. **Re-commit** - Commit the change without the credential
5. **Report** - Tell the team lead

### If Credentials Were Already Pushed

1. **Immediately rotate** the exposed credentials
2. **Contact** the team lead
3. **Audit logs** to see if the credential was used
4. **Remove** the commit from history using `git filter-branch` or BFG Repo Cleaner

## Environment Variable Management

### Local Development
Each developer maintains their own `.env.local` file (not in git):

```bash
# .env.local (ignored by git)
SUPABASE_JWKS_URL=https://[your-project].supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_AUDIENCE=authenticated
BREVO_API_KEY=your-actual-key-here
```

### Staging/Production
Use GitHub Secrets or your deployment platform's secret management:

```yaml
# In GitHub Actions workflows
env:
  SUPABASE_AUDIENCE: ${{ secrets.SUPABASE_AUDIENCE }}
  BREVO_API_KEY: ${{ secrets.BREVO_API_KEY }}
```

## Documentation Best Practices

### ✅ Good Documentation
- Uses `[placeholder]` syntax for sensitive values
- Shows configuration structure, not real credentials
- Includes examples with `example.com` domains
- Uses `[your-project-id]` for project-specific values

### ❌ Bad Documentation
- Includes real API keys
- Shows actual token values
- Contains real project URLs
- Exposes real email addresses

## Resources

- [Gitleaks GitHub](https://github.com/gitleaks/gitleaks)
- [Pre-commit Framework](https://pre-commit.com/)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

## Questions?

If you're unsure whether something is safe to commit, err on the side of caution and ask the team lead.
