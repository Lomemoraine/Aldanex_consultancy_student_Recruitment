# Aldanex ERP — Student Recruitment & Admission Tracking System

A full-stack ERP built with **Next.js**, **Node.js**, and **Supabase**.

## Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Email:** Nodemailer (cPanel SMTP)
- **SMS:** Twilio

---

## Notification System

### Email Notifications
Triggered automatically for:
- ✅ Email verification OTP on registration
- ✅ Welcome email after account verification
- ✅ Application stage updates
- ✅ Document approved / rejected / resubmit requested
- ✅ Counseling session scheduled

### SMS Notifications (Twilio)
Triggered automatically for:
- ✅ Application stage changes
- ✅ Document approved or rejected
- ✅ Offer letter received
- ✅ Visa decision (approved or rejected)
- ✅ Counseling session scheduled

---

## Setup

### 1. Install dependencies
```bash
cd backend && npm install
cd frontend && npm install
```

### 2. Configure environment variables
```bash
cd backend
copy .env.example .env
# Fill in your credentials
```

### 3. Get Twilio credentials
1. Sign up at [twilio.com](https://www.twilio.com)
2. Go to Console → Account Info
3. Copy **Account SID** and **Auth Token**
4. Buy a phone number (or use trial number)
5. Add to `backend/.env`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+12025551234
```

### 4. Run database migrations
Run SQL files in order from `supabase/migrations/` in Supabase SQL Editor.

### 5. Start the project
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

---

## Registration Flow
1. Student fills in registration form
2. Backend sends **6-digit OTP** to their email
3. Student enters OTP on `/verify` page
4. Account confirmed → **Welcome email** sent
5. Student redirected to login

---

## Deployment
- **Frontend** → Vercel
- **Backend** → Railway
- **Database** → Supabase (already hosted)

See `SETUP.md` for detailed deployment steps.
