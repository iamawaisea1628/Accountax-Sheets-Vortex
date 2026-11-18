# Accountax

Entry sheet, CSV import and team management. Closings and summaries come in the next phase, built from the entry sheet.

Stack: Next.js 15, Supabase (login and database), Tailwind, Framer Motion. Hosted on Vercel. Nothing runs on your computer.

## 1. Set up Supabase (10 minutes)

1. Create a project at supabase.com and wait for it to finish starting.
2. Open **SQL Editor > New query**, paste the whole of `supabase/schema.sql`, and press **Run**.
3. Open **Authentication > Users > Add user > Create new user**. Enter your email and a password, and tick **Auto confirm user**.
4. Make yourself admin. In the SQL Editor run (use your email):

   ```sql
   update public.profiles set role = 'admin' where email = 'YOUR-EMAIL@example.com';
   ```
5. Open **Authentication > Sign In / Providers** and turn **off** "Allow new users to sign up". Only you create accounts.
6. Open **Project Settings > API**. Copy the **Project URL**, the **anon (or publishable) key** and the **service_role key**.

## 2. Put the code on GitHub

1. Unzip the file. Create a new empty repository on github.com.
2. Open the unzipped folder, select everything inside it (not the folder itself) and drag it onto the repository page, then press **Commit changes**.

## 3. Deploy on Vercel

1. In Vercel choose **Add New > Project** and import the GitHub repository.
2. Before pressing Deploy, open **Environment Variables** and add these three (names exactly as written):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret, never share it) |

3. Press **Deploy**, then open the live link and sign in.

## 4. Import this month's data

1. In Google Sheets, open Entry-Main and choose **File > Download > CSV**. Do the same for Entry-Service.
2. In Accountax open **Import CSV**, choose "Main entries" or "Service entries", pick the file, check the preview and press Import.
3. Import each file once. Importing the same file twice creates duplicates.

CSV columns: Date, Account Name, Customer Name, Amount, Status, Office, Shift, Manager, Group, Remarks. Dates like `31-Oct-2026` and amounts like `$106.87` or `-$159.22` are understood.

## Who can do what

- **Admin:** sees and edits everything, imports CSV, creates and removes managers.
- **Manager:** sees all entries, adds entries, and edits or deletes only their own.

Dropdown values: statuses are in `lib/types.ts`. Offices and shifts are the `offices` and `shifts` tables in Supabase (Table Editor), and new ones are added automatically by CSV import.
