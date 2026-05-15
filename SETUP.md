# Setup Guide

## Prerequisites
- Node.js 18+
- A Supabase account (free tier works)

---

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and create a new project
2. Note your **Project URL** and **API Keys** (anon + service_role)
3. Go to **Storage** → Create a bucket called `student-documents` (set to private)

---

## Step 2: Run Database Migrations

In your Supabase project:
1. Go to **SQL Editor**
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/migrations/002_functions_triggers.sql`

---

## Step 3: Configure Environment Variables

### Backend
```bash
cd backend
copy .env.example .env
# Edit .env with your Supabase credentials
```

### Frontend
```bash
cd frontend
copy .env.example .env.local
# Edit .env.local with your Supabase credentials
```

---

## Step 4: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

---

## Step 5: Run the Project

Open two terminals:

**Terminal 1 – Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 – Frontend:**
```bash
cd frontend
![alt text](image.png)
# Runs on http://localhost:3000
```

---

## Step 6: Create First Admin Account

1. Register a student account at http://localhost:3000/register
2. In Supabase SQL Editor, manually update the role:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```
3. Log in and access the admin panel at http://localhost:3000/admin

---

## Project URLs

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Student portal |
| http://localhost:3000/admin | Admin/counselor portal |
| http://localhost:5000/health | API health check |

---

## Optional Integrations

### Stripe (Payments)
- Add your Stripe keys to backend `.env`
- Set up webhook endpoint: `POST /api/payments/webhook`

### WhatsApp (Twilio)
- Add Twilio credentials to backend `.env`

### Zoom
- Add Zoom OAuth credentials for meeting scheduling
