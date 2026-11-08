# Maths Formula Sheet

A searchable formula sheet web app for Engineering Mathematics (Basics + M1–M4):

- Public viewing without login; accounts (Supabase Auth) required to add content
- Owners can edit/delete only their own entries; admins can manage everything
- Categories can be created by logged-in users; syllabus can be added as text or file uploads
- "FormulaText" markup (`\frac{a}{b}`, `x^{2}`, `\sqrt{...}`, `MAT(a, b; c, d)`) renders book-style formulas; a ready-made AI prompt on the Add page produces this format
- Built-in analytics: page/formula views, referrers, geo, device/OS, shares — visible in the admin dashboard
- SEO: per-category pages + sitemap

Stack: Next.js 14 (basePath `/math-formula-sheet-m1`), Supabase (Postgres + Auth + Storage).

Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS` (comma-separated admin emails).
