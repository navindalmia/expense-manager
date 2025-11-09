# 🗺️ Expense Manager — Project Roadmap

A modular, multilingual expense management system with a clean backend–frontend separation.

---

## 📦 Project Overview

| Aspect | Description |
|--------|--------------|
| **Backend** | Node.js + Express (v5), Prisma ORM, PostgreSQL |
| **Frontend** | Planned: React + Vite + Tailwind |
| **Internationalization** | i18next with filesystem backend (supports `en`, `fr`) |
| **Error Handling** | Centralized AppError + error middleware + i18n translation |
| **Architecture** | Layered: Controller → Service → Prisma + Utils |
| **Goal** | Scalable expense tracker with user, category, and expense management |

---

## ✅ Phase 1 — Core Backend Setup (✔ Completed)

| Task | Status |
|------|--------|
| Initialize project with TypeScript + ESLint + dotenv | ✅ |
| Configure Express app & middleware stack | ✅ |
| Set up Prisma ORM + PostgreSQL schema | ✅ |
| Implement base CRUD for **Expenses** | ✅ |
| Add centralized **AppError** class | ✅ |
| Add **errorHandler** middleware | ✅ |
| Integrate **i18next** backend + middleware | ✅ |
| Add multilingual support (`en` + `fr`) | ✅ |
| Implement clean service layer (ExpenseService) | ✅ |
| Add Zod validation for create expense schema | ✅ |
| Verify error translation & status code consistency | ✅ |
| Structure finalized (`src/app.ts`, `src/server.ts`, etc.) | ✅ |

---

## 🚧 Phase 2 — Frontend Bridge (🟡 In Progress)

Goal: Build a minimal test frontend to validate backend, translation, and error flows.

| Task | Description | Status |
|------|--------------|--------|
| 🏗️ Setup React + Vite + Tailwind project | Initialize lightweight frontend | ⏳ Pending |
| 🌐 Connect to `/api/expenses` endpoint | Display list of expenses | ⏳ Pending |
| ➕ Add “Create Expense” form | Test POST API | ⏳ Pending |
| 🌍 Implement language toggle (`en` / `fr`) | Send `Accept-Language` header in Axios | ⏳ Pending |
| 🧪 Validate translated error responses | Confirm `AppError` + i18n working end-to-end | ⏳ Pending |

---

## 🔒 Phase 3 — User & Category Modules (🗓 Planned)

| Task | Description |
|------|--------------|
| Create **User** model & CRUD endpoints |
| Create **Category** model & CRUD endpoints |
| Link expense to category/user dynamically |
| Add data validation for relationships |
| Write unit tests for these modules |

---

## 🔐 Phase 4 — Authentication & Access Control (Planned)

| Task | Description |
|------|--------------|
| Add JWT-based authentication |
| Create signup/login endpoints |
| Protect expense routes (per user) |
| Add password hashing and token expiry |
| Middleware for authentication & role-based access |

---

## 🌍 Phase 5 — Advanced Features (Future)

| Task | Description |
|------|--------------|
| Expense sharing and settlement calculations |
| Support multiple currencies and live exchange rates |
| Attachments (images, receipts) |
| Dashboard analytics |
| Unit and integration test coverage |
| Docker + CI/CD pipeline |

---

## 🧰 Development Utilities

| Tool | Purpose |
|------|----------|
| **Prisma Studio** | View and edit database visually |
| **Zod** | Runtime validation of incoming data |
| **i18next** | Internationalization framework |
| **Cors & Helmet** | Security and cross-origin support |
| **Dotenv** | Environment variable management |

---

## 🧭 Current Focus

> 🔹 Finalizing i18n consistency  
> 🔹 Adding frontend bridge to visualize translations & API  
> 🔹 Ensuring Express 5 async error flow reaches `errorHandler`

---

## 🧩 Next Immediate Steps

1. Create `frontend/` folder → initialize React + Vite project  
2. Build a small dashboard + form for expenses  
3. Add Axios instance with `Accept-Language` header  
4. Test English and French error messages end-to-end  
5. Commit progress → `chore: add frontend test UI + i18n validation`

---

## 📅 Estimated Timeline

| Phase | Duration | Status |
|-------|-----------|--------|
| Phase 1 — Core Backend | ✅ Complete |
| Phase 2 — Frontend Bridge | 🟡 1–2 days |
| Phase 3 — Users & Categories | 🗓 2–3 days |
| Phase 4 — Auth | 🗓 2–3 days |
| Phase 5 — Extras & Deployment | 🗓 Optional |

---

## 👨‍💻 Maintainer Notes

- All new API endpoints **must throw `AppError`** for consistency.
- Always test both languages before merging backend changes.
- Keep `locales/en/translation.json` and `locales/fr/translation.json` in sync.
- Commit messages follow convention:  
  - `feat:` for new features  
  - `fix:` for bug fixes  
  - `refactor:` for internal code cleanup  
  - `chore:` for maintenance or minor updates

---

**📍 Next milestone:**  
➡️ Start `frontend/` folder setup and connect to `/api/expenses`  
➡️ Validate i18n in both directions (backend → frontend)  
➡️ Document API routes in Swagger or Postman collection

---

🧡 *Expense Manager – built with clarity, modularity, and multilingual reach.*
