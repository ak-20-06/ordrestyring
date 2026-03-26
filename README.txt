Ordrestyring clean rebuild

Det her er en helt ny version bygget op fra bunden for at undgå de gamle runtime-fejl.

Sådan sætter du den op:
1. Kør supabase/schema.sql i Supabase SQL Editor
2. Opret en Storage bucket der hedder ks-files
3. Brug env vars fra .env.example

Lokalt:
npm install
npm run dev

Build:
npm run build

Netlify:
Build command: npm run build
Publish directory: dist
Env vars:
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_KS_BUCKET

Bemærk:
- Ingen login endnu
- Asger og Kasper er faste profiler
- Hvis Supabase env mangler, vil appen vise en fejl i stedet for hvid side
