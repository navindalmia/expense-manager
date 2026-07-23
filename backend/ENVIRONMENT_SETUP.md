# Backend Environment Setup

## 🚀 For New Machines (After Cloning)

### 1. Copy Environment Template
```bash
cd backend
cp .env.example .env.local
```

### 2. Fill in Local Values
Edit `.env.local` with:
- **Database**: Your local PostgreSQL connection string
- **JWT_SECRET**: Keep the placeholder for development
- **SendGrid**: Add your SendGrid API key (from `.env.local` on your original machine, or generate new)
- **Frontend URL**: Keep as `http://localhost:8081` for local development

### 3. Start Backend
```bash
npm start
```

**Environment Loading Order:**
1. `.env.local` loads first (highest priority)
2. `.env` loads as fallback
3. System environment variables override both

---

## 🔒 Security Rules

✅ **DO:**
- Keep `.env.local` with actual secrets on local machine only
- Add `.env.local` to `.gitignore` (ALREADY DONE)
- Use `.env.example` as template (ALREADY CREATED)
- Store production secrets in deployment platform

❌ **DON'T:**
- Commit `.env.local` to git
- Share `.env.local` over chat/email
- Hardcode secrets in source code
- Use same secrets across dev/prod

---

## 📦 Production Deployment

In production, secrets come from **environment variables**, NOT from files:

### Docker / Kubernetes / Azure
```yaml
# docker-compose.yml or Kubernetes manifest
environment:
  - DATABASE_URL=${DATABASE_URL}
  - SENDGRID_API_KEY=${SENDGRID_API_KEY}
  - JWT_SECRET=${JWT_SECRET}
  # ... etc
```

### Azure App Service / Functions
```bash
az functionapp config appsettings set \
  --name myapp \
  --resource-group mygroup \
  --settings \
    DATABASE_URL=postgresql://prod:secret@prod-server/prod_db \
    SENDGRID_API_KEY=SG.prod_key \
    JWT_SECRET=prod_secret \
    NODE_ENV=production
```

### GitHub Actions (CI/CD)
```yaml
- name: Deploy to Azure
  uses: azure/appservice-deploy@v2
  env:
    DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
    SENDGRID_API_KEY: ${{ secrets.PROD_SENDGRID_API_KEY }}
    JWT_SECRET: ${{ secrets.PROD_JWT_SECRET }}
```

**Key Principle:** Environment variables from the deployment platform, never from `.env.local`

---

## 🔧 Troubleshooting

**"Email not sending"**
- Check: Is `.env.local` loaded? (See server logs)
- Check: `SENDGRID_API_KEY` present in `.env.local`?
- Check: `NODE_ENV` is development for Ethereal fallback

**"New machine, don't know what variables needed"**
- Copy `.env.example` → `.env.local`
- Fill in values
- Ask team for SendGrid key if needed

**"Want to switch from SendGrid to Ethereal for testing"**
- Edit `.env.local`: Remove `SENDGRID_API_KEY`
- Add `ETHEREAL_USER` and `ETHEREAL_PASS`
- Restart backend

---

## 📞 For Team

When onboarding:
1. Clone repo
2. Run `cp backend/.env.example backend/.env.local`
3. Ask for `.env.local` values from team (Slack, secure channel)
4. Or generate own SendGrid key if you have access
5. Run `npm start` - should work!

Never:
- Send `.env.local` via email
- Commit `.env.local` to git
- Push secrets to public repos
