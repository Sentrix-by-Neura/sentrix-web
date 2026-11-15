# Sentrix Web

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-0F172A?style=flat-square&logo=tailwindcss&logoColor=38BDF8)
![Supabase Auth](https://img.shields.io/badge/Supabase_Auth-12372A?style=flat-square&logo=supabase&logoColor=3ECF8E)
![Recharts](https://img.shields.io/badge/Recharts-087E8B?style=flat-square)
![GSAP](https://img.shields.io/badge/GSAP-18231A?style=flat-square&logo=gsap&logoColor=88CE02)

Sentrix Web is a dashboard for AC electrical monitoring and predictive maintenance. It shows live and historical current readings, sensor status, and anomaly alerts.

## Run locally

1. Start the `sentrix-api` backend. The Next.js app needs it to load monitoring data and manage devices.
2. From the repository root, copy `.env.example` to `.env.local`. Fill in the Supabase Auth values and set `NEXT_PUBLIC_API_URL` to the API origin, typically `http://localhost:9000`.
3. Install dependencies from the repository root.

   ```sh
   pnpm i
   ```

4. Start the development server.

   ```sh
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).
