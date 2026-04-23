# AllTeacher iOS

React Native + Expo + Expo Router. Subscription-based personalized learning app — talks to the Flask backend in `../backend`.

## Quick start

```bash
cd ios
npm install
cp .env.example .env           # set EXPO_PUBLIC_API_URL
npx expo start --ios           # opens iOS Simulator
```

With the backend running (`python ../backend/app.py`), the home screen should show a green "ok" card within a second.

## Running on a physical iPhone

Your phone and Mac must be on the same Wi-Fi.

1. Find your Mac's LAN IP: `ipconfig getifaddr en0`
2. Set `EXPO_PUBLIC_API_URL=http://<that-ip>:8000` in `.env`
3. `npx expo start` — scan the QR with the Expo Go app

## Layout

```
ios/
  app/                       # Expo Router file-based routes
    _layout.tsx              # Root stack
    index.tsx                # Home — /health connectivity check
  lib/
    api.ts                   # Flask API client
    supabase.ts              # Supabase Auth (stub)
    revenuecat.ts            # RevenueCat (stub)
```

As we add screens — `(auth)/login.tsx`, `(tabs)/index.tsx`, `curriculum/[id].tsx`, etc. — they go under `app/` following the structure in the top-level AllTeacher brief.
