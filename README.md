# Mamute MAA

Monorepo for the Mamute MAA admin desktop app and student mobile app.

## Requirements

- Node `20.19.4` (see `.nvmrc` / `.node-version`)
- Supabase project with the schema in `supabase/schema.sql` applied

## Setup

```bash
npm install
```

Create environment files:

`apps/admin-desktop/.env`
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

`apps/student-app/.env`
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## Run apps

### Admin Desktop (Windows, Tauri)

```bash
npm run dev:admin
npm run tauri dev --workspace admin-desktop
```

### Student Mobile App (Expo)

```bash
npm run start --workspace student-app
```

## Supabase Edge Functions

Deploy after changes:

```bash
supabase functions deploy recordAttendance
supabase functions deploy linkStudentAccess
supabase functions deploy createAdminUser
supabase functions deploy makeMeAdmin
supabase functions deploy registerMobileUser
supabase functions deploy verifyStudentLink
supabase functions deploy verifyGuardianLink
```

## Initial admin bootstrap (one-time)

After you create the first admin user in Supabase Auth, call the `makeMeAdmin`
edge function once to insert the first row in `admins`. It will reject any
calls after the first admin exists.

## Notes

- Student barcode format: `MMAA-<student_number>`
- Mobile app opens to the barcode screen by default
- Guardian check-in supports multiple children in the Family tab
