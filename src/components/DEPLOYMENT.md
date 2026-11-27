---

### `DEPLOYMENT.md`

```markdown
# OpEx Task Manager — Production Architecture & Deployment Guide

## 1. Production Architecture

```text
User
 ↓
Vercel (Static SPA + Security Headers + SPA Rewrites)
 ↓
React App (Vite + TypeScript + Material UI)
 ├──▶ Supabase Auth (Email/Password JWT + Session Refresh)
 ├──▶ Supabase Database (PostgreSQL + RLS + Triggers)
 └──▶ Supabase Storage (Private Bucket: task-attachments)
