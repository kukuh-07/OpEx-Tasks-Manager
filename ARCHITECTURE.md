# OpEx Task Manager — Complete Application & Database Architecture

## 1. End-to-End Runtime Architecture

```text
User Browser (Desktop / Mobile)
 ↓ HTTPS
Vercel Edge Network
 ├── Static SPA Hosting (Vite + React 19 + TypeScript + Material UI v9)
 ├── Security Headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
 └── Client-Side SPA Rewrite (/(.*) -> /index.html)
 ↓ Direct SDK Calls (HTTPS + JWT Bearer Token)
Supabase Platform
 ├── Supabase Auth (Email/Password sign-in, signup trigger -> public.profiles)
 ├── Supabase Database (PostgreSQL 15 + 11 Relational Tables + 2 Analytics Views + RLS)
 └── Supabase Storage (Private bucket: task-attachments, 15 MB limit, MIME-validated)
