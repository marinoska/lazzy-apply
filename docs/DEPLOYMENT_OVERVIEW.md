# Deployment

## Environments

| Env | Queue | R2 Bucket | Worker flag |
|-----|-------|-----------|-------------|
| Local | `parse-cv-local` | `local` | `--env local` |
| Dev | `parse-cv-dev` | `dev` | `--env dev` |
| Prod | `parse-cv` | `prod` | (default) |

## Deploy

```bash
git push origin main  # Auto-deploys dev API + worker
```

Prod: Manual via Render dashboard + GitHub Actions workflow

## Rollback

```bash
wrangler rollback [id] --env dev  # Worker
# Render: Dashboard → Deploys → Rollback
```
