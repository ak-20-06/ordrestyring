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


v2 fix:
- rettet runtime-fejl: Table2 icon var ikke importeret i App.jsx


v3 design:
- helt nyt lysere UI
- større kort og pænere kalender
- renere ordrekort og paneler


v4 ændringer:
- venstremenu virker nu som rigtige sider/faner
- startside er nu kun kort + kalender
- dagsregistrering og timeregistrering har egne sider
- bruger vælges i timeregistrering
- nederste lille ugekolonne er fjernet
- bookede weekenddage er nu røde
- kalenderfelter viser kunde, opgaven er for og titel
- nyt felt på ordrer: assigned_to / 'opgaven er for'


v5 brugerønsker:
- startside er nu kun kort + kalender + dagsregistrering
- timeregistrering viser valgt bruger/navn og kun det skema
- små nederste kolonner er fjernet
