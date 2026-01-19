# HotelTrack Setup

## 1) Supabase project
- Create a new Supabase project.
- In the SQL editor, run `supabase/schema.sql`.
- Then run `supabase/seed.sql` to create the default admin account.

Default admin credentials:
- Username: admin
- Password: 123

## 2) Environment variables
Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
AUTH_SECRET=replace_with_a_long_random_string
```

## 3) Run locally
```
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes
- No public sign-up is exposed. Admin creates staff accounts in the Staff page.
- Payments are intentionally excluded (based on project scope).
