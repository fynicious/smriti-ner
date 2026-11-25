# SMRITI (Smriti-NER) — Complete Product, UI/UX Map, Architecture & Upgrade Blueprint

> **Purpose of This Document:**  
> This document is an **end-to-end visual, functional, and technical blueprint** of **Smriti (`Smriti-NER`)** as it exists today, plus a **prioritized roadmap of improvements** to evolve it into a calm, Apple iOS-inspired, uncluttered, icon-first, strongly encrypted, and zero-cost platform purpose-built for elderly dementia/memory-care patients and families in India's North Eastern Region (NER).  
> You can hand this file directly to any UI/UX designer, mobile/web engineer, or AI assistant to immediately understand every screen, option, button, role, database model, security mechanism, and design improvement target.

---

## 1. Product Vision & Core Guardrails

- **Target Users:** Elderly adults experiencing dementia, mild cognitive impairment (MCI), or age-related memory difficulty in India's North Eastern Region (Assam, Meghalaya, Manipur, Nagaland, Mizoram, Arunachal Pradesh, Tripura, Sikkim), alongside their family caregivers and visiting clinicians.
- **Core Product Roles:**
  1. **`PATIENT`:** Guided daily structure, hydration tracking, medication check-offs, memory/brain games, voice-enabled memory scrapbook, AI companion, one-tap SOS & local help directory.
  2. **`CAREGIVER`:** Multi-patient management, 6-digit pairing, daily routine builder with family voice recordings, longitudinal wellbeing tracking & CSV export, Care Circle updates, GPS safe-zone geofencing, family photo/voice asset manager, local NER resources, and offline-sync/JSON backup controls.
  3. **`CLINICIAN`:** Invite-verified healthcare professional portal displaying patient demographics, vitals trends, prescription management (`ACTIVE` / `DISCONTINUED`), unified longitudinal timeline, cognitive engagement accuracy charts, non-diagnostic statistical trend indicator, and printable/CSV summaries.
- **Non-Negotiable Safety Principles:**
  - **Non-Diagnostic:** Smriti supports routine adherence, cognitive stimulation, and caregiver awareness. It **never** diagnoses, stages, treats, or replaces clinical judgment.
  - **Free for Families:** Built on zero-subscription web technologies (PWA + browser Web Speech/Audio + IndexedDB offline cache + open-source mapping/weather + free-tier serverless APIs).
  - **Fail-Closed Privacy:** Unauthenticated requests are rejected (`401`); cross-patient data access across `PATIENT`, `CAREGIVER`, and `CLINICIAN` roles is strictly blocked (`403`).

---

## 2. Visual Design System & Current UI Aesthetics

Defined in `tailwind.config.ts`, `src/app/globals.css`, and `src/app/layout.tsx`:

- **Theme Style:** Soft pastel, "Flo-style" calming palette built for low visual stress (`antialiased`, generous padding, large rounded card corners `rounded-[28px]` to `rounded-[40px]`).
- **Typography:** Google Font `Inter` (`--font-inter`).
- **Color Palette (`tailwind.config.ts`):**
  - Background surface: `#FDFBF7` (`flo-bg` / `background`)
  - Primary foreground ink: `#2D3748` (`flo-text` / `foreground`) paired with Tailwind Slate scale (`text-slate-900`, `text-slate-800`, `text-slate-600`)
  - **Mint (`#f2fcf5` -> `#2f865b`):** Completion states, patient active navigation, Clinical portal hero (`bg-bubble-mint`)
  - **Peach (`#fff7f5` -> `#ff6639`):** Login surface, Smriti AI bar accents, active voice controls, celebration modals
  - **Lavender (`#f6f5fa` -> `#7e70ad`):** Caregiver portal hero (`bg-bubble-lavender`), Medication category, Guess Faces game, Cognitive charts
  - **Sky / Emerald / Amber / Rose (Tailwind defaults):** Hydration (`sky`), Health Check-Ins & Disclaimers (`amber`), Hospitals/Emergency (`rose` / `emerald`)
- **Shadows & Radii:**
  - Soft diffused elevation (`shadow-soft`, `shadow-plush`), soft pill buttons (`rounded-full`, `rounded-2xl`), pastel gradients (`hero-gradient`, `bubble-mint`, `bubble-peach`, `bubble-lavender`).
- **Global Persistent Chrome (`src/components/layout/`):**
  - **`BottomNav.tsx`:** Role-adaptive fixed bottom navigation bar, automatically **hidden** on `/login`, `/register`, `/check-in`, and `/offline`:
    - **Patient routes (`/`, `/games/*`, `/scrapbook`, `/help-near-me`, `/profile`):** `Home` (`/`), `Games` (`/games`), `Memories` (`/scrapbook`).
    - **Caregiver routes (`/caregiver/*`):** `Caregiver` (`/caregiver`), `Routines` (`/caregiver/routines`), `Settings` (`/caregiver/settings`).
    - **Clinician route (`/doctor`):** `Account` (`/profile`), `Clinical Portal` (`/doctor`).
  - **`SpeakButton.tsx`:** Fixed floating buttons above `BottomNav` (`bottom-24 right-4`) containing a Globe (`Language Picker` modal for 16 NER & Indian languages) and a Speaker toggle (`Read screen aloud` / `Stop reading`). Automatically **hidden** on `/login`, `/register`, `/check-in`, `/offline`, and `/doctor`.

---

## 3. Authentication, Pairing & Security Flow

1. **Registration (`/register` -> `POST /api/auth/register`):**
   - Inputs: Full Name (2–100 chars), Email (regex validated, stored lowercase), Password (min 8 chars, hashed via `bcryptjs` cost factor `12`), Role (`PATIENT`, `CAREGIVER`, `CLINICIAN`).
   - `CLINICIAN` registration requires matching server env `CLINICIAN_INVITE_CODE` via timing-safe comparison (`safeCompareSecrets` in `src/lib/env.ts`).
   - Creating a `PATIENT` auto-initializes a `PatientProfile` and a default `2000 ml` `HydrationTarget`.
2. **Login (`/login` -> NextAuth Credentials `src/lib/auth.ts`):**
   - Uniform `"Invalid email or password"` error (prevents account enumeration), per-email rate limit (`10` failed attempts per `15` minutes), `7`-day JWT session signed by fail-closed `NEXTAUTH_SECRET`.
3. **Edge Middleware (`src/middleware.ts`):**
   - Intercepts `/caregiver`, `/caregiver/:path*`, `/doctor`, `/doctor/:path*`, `/profile`, `/check-in`.
   - Unauthenticated visitors redirect (`307`) to `/login`. Wrong roles are redirected back to their own portal (`/` for `PATIENT`, `/caregiver` for `CAREGIVER`, `/doctor` for `CLINICIAN`).
4. **Role Linking & Pairing (`src/services/pairing.service.ts`):**
   - **Caregiver -> Patient:** Caregiver generates a `6-digit` time-limited (24-hour) code (`POST /api/pairing` or Care Circle `Invite`). Patient redeems the code under `/profile` (`POST /api/pairing`), creating an `ACTIVE` `PatientCaregiver` link.
   - **Clinician -> Patient:** Clinician assigns a patient on `/doctor` (`POST /api/clinician/patients`) using the patient's registered email plus an active caregiver-issued `6-digit` pairing code, creating an `ACTIVE` `CareCircleMember` row.

---

## 4. Visual Screen Maps & Complete Feature Inventory ("Where Every Option Lives")

### Visual Layout At-a-Glance (Current Screen Wireframes)

```text
+-------------------------------------------------------------------+
| PATIENT HOME (/)                                                  |
| [Settings2 Gear]                         [Red SOS PhoneCall Fab]  |
|   -> Profile & Pairing / Sign Out          -> Caregiver SMS + 112 |
|                                                                   |
|     [ Morning Landscape SVG Overlay ]                             |
|       GOOD MORNING / AFTERNOON / EVENING                          |
|       [ Patient First Name ]   [Listen Button]                    |
|       [ Smriti Companion Bar: Ask me anything... (Mic Icon) ]     |
|                                                                   |
| [ Date, Clock & Guwahati Open-Meteo Weather Widget + Listen ]     |
| [ Opt-in Location Sharing Banner: Allow Tracking / Live Dot ]     |
| [ Amber Daily Check-In Banner (if undone today) -> /check-in ]    |
| [ Daily Hydration Card: Progress Bar + "+1 Glass (250ml)" + Undo ]|
| [ NOW Card: Time + Icon + Title + Voice Clip + "I Took It"/Snooze]|
| [ Today's Brain Games Launcher Card -> /games ]                   |
| [ Upcoming Planner Timeline (Medications + Routines merged) ]     |
| [ Help Near Me Card -> /help-near-me ]                            |
|                                                                   |
|                              [Globe Lang Picker] [Speak Toggle]   |
| [ BottomNav: Home (/) | Games (/games) | Memories (/scrapbook) ]  |
+-------------------------------------------------------------------+

+-------------------------------------------------------------------+
| CAREGIVER PORTAL (/caregiver/*)          CLINICIAN PORTAL (/doctor)|
| [ Settings ]   [ Sync All (n) ]          [Assign] [CSV] [Print] [Out]
| [ CaregiverPatientBar: Switch / +Code ]  [ Patient Dropdown + Info]|
| [ Patient Today: Water (L) & Meds Count] [ Disclaimer Banner ]     |
| [ 8-Tile Feature Grid: Routines,         [ 5 Tabs:                 |
|   Wellbeing, Circle, Safety Map,           Overview | Vitals | Rx | |
|   Voice, Family, Resources, Settings ]     Timeline | Engagement ]  |
| [ Cognitive Accuracy LineChart ]                                  |
| [ Health & Vitals Form + Scrapbook Upload ]                       |
| [ BottomNav: Caregiver | Routines | Settings ]                    |
+-------------------------------------------------------------------+
```

---

### A. Patient Experience

1. **`/` — Patient Home Dashboard (`src/app/page.tsx`)**
   - **Top-Left Settings Button (`Settings2` gear icon):** Tap drawer showing signed-in name, **`My Profile & Pairing`** (`/profile`), and **`Sign Out`**.
   - **Top-Right Emergency SOS Button (`PhoneCall` crimson circle):** Opens accessible Emergency SOS modal (`role="dialog"`) with **`Send SOS Alert to Caregiver`** (`POST /api/alert`) and direct **`Call Emergency (112)`** (`tel:112`).
   - **Greeting Banner (local NER SVG morning landscape):** Dynamic time-of-day greeting (`Good Morning` / `Good Afternoon` / `Good Evening` via `getTimeOfDayBucket()`), patient's first name, **`Listen`** read-aloud button (`ListenButton`), and the **`Smriti Companion`** bar opening `ConversationalUI`.
   - **Date, Time & Live Weather Card (`TimeWeatherWidget`):** Local clock, formatted date, Open-Meteo Guwahati weather badge when online (omitted cleanly when offline), and **`Listen`** time readout button.
   - **Location Sharing Card (`useGeolocationEngine`):** Opt-in prompt **`Allow Tracking`**; once granted, tracks GPS geofencing against caregiver-defined `SafeZone`s and sends live pings to `/api/patients/[id]/safety`.
   - **Daily Check-In Banner (shown if today's check-in is incomplete):** Warm amber card launching `/check-in` (**`START CHECK-IN`**).
   - **Daily Hydration Card:** Shows logged ml vs target ml (glasses count + progress bar), large **`+1 Glass (250ml)`** button (`POST /hydration`), and **`Undo`** button (`RotateCcw`).
   - **NOW Card (`NowCard.tsx`) & Upcoming Timeline (`PlannerTimeline.tsx`):** Shows the most pressing due routine or medication (`It's Time`), caregiver voice playback (or TTS), **`I Took It` / `Done`** button, and **`Remind Me Later`** snooze action; timeline below shows the rest of today's merged routines & prescriptions. Also triggers fullscreen **`RoutineNotification`** modal automatically when a due routine includes a recorded family voice prompt.
   - **Today's Brain Games Card:** Direct card linking to `/games`.
   - **Help Near Me Card:** Direct card linking to `/help-near-me`.

2. **`/check-in` — Daily Wellbeing Check-In (`src/app/check-in/page.tsx`)**
   - Focused distraction-free flow (`BottomNav` and `SpeakButton` hidden).
   - Progress dots at top + Back arrow to `/` + TTS **`Listen`** button per question.
   - 6 single-question screens (`mood`, `sleepQuality`, `confusionLevel`, `energyLevel`, `painLevel`, `overallWellbeing`) with 3 huge emoji cards (`0 = Good/Clear/None`, `1 = Okay/Mild`, `2 = Not Good/Poor/Severe`).
   - Saves synchronously to `POST /api/patients/[id]/wellbeing` and local Dexie `wellbeingEntries`, then displays an `"All Done!"` card.

3. **`/games` — Cognitive Activities Hub & 14 Games (`src/app/games/`)**
   - Hub lists all **14 games** in a 1-to-2 column responsive grid, each with pastel icon tile, title, and short description:
     - **Memory & Recognition:** `guess-faces` (Family photos from `/family-assets`), `recognize-voices` (Recorded family voice clips), `memory-match` (Local NER SVG pairs — tea, bamboo, spices, rice, lantern, basket, rhino, handloom), `color-sequence` (3-level illuminated pattern recall), `pattern-weave` (5-level cultural weave recall with gentle pattern replay on error).
     - **Attention & Visuospatial:** `find-the-item` (4/9/16 grid adaptive search), `odd-one-out`, `shadow-match`.
     - **Executive & Language:** `daily-routine`, `sorting-game`, `object-recognition`, `word-association`, `word-garden` (Multi-script Assamese/Bengali/English vocabulary cards).
     - **Social/Emotional:** `emotion-recognition`.
   - **Adaptive & Telemetry Layer:** All 14 games log accuracy, errors, reaction times, and difficulty via `logCognitiveSession()` (`src/lib/cognitive-logger.ts` + `useGameAdaptation`) to IndexedDB (`db.gameLogs`) and `POST /api/patients/[id]/cognitive`. `GameContainer` provides consistent back navigation to `/games`, celebratory fanfare (`src/lib/sound.ts`), `Play Again`, and `Back to Activities`.

4. **`/scrapbook` — Reminiscence Memory Book (`src/app/scrapbook/page.tsx`)**
   - Card-by-card storybook combining Caregiver/Patient uploaded entries (`/api/patients/[id]/scrapbook`) with offline NER cultural/music scenes (`public/assets/ner/family.svg`, `river.svg`, `festival.svg`).
   - Includes **Back Home**, **`+` Add a Memory Page** modal (Title, Story/Prompt, Photo file upload), **Delete** button on saved pages, TTS prompt reader, and real **`MediaRecorder`** microphone capture + HTML5 `<audio controls>` playback persisted via `PATCH /api/patients/[id]/scrapbook`.

5. **`/help-near-me` — Local NER Support Directory (`src/app/help-near-me/page.tsx`)**
   - Search bar (town/district/service) + 6 large category buttons (`EMERGENCY`, `DOCTORS & CARE`, `HOSPITALS`, `PHARMACIES`, `HELPLINES & SUPPORT`, `COMMUNITY & NGOs`).
   - Backed by idempotently seeded `/api/resources` (10 verified/community NER entries including `112` Emergency, `108` Mrityunjoy Ambulance, `14567` Elder Line, `14416` Tele-MANAS, GMCH Guwahati, LGBRIMH Tezpur, NEIGRIHMS Shillong, RIMS Imphal, ARDSI Guwahati, Janaushadhi Kendra) with offline Dexie cache, bookmarking (`POST /api/resources`), direct `tel:` dialing, SOS secondary numbers, and TTS card reading.

6. **`/profile` — Profile, Language & Caregiver Pairing (`src/app/profile/page.tsx`)**
   - Editable user & clinical basics (`Full Name`, `Blood Group`, `Emergency Phone`, `Allergies`, `Support Notes`, `Preferred Language`) persisted via `PATCH /api/profile`.
   - **`Link a Caregiver`** section for `PATIENT`: 6-digit invite code redemption + active linked caregiver list with revoke option (`/api/pairing`), plus **`Sign Out of App`**.

---

### B. Caregiver Portal (`/caregiver/*`)

Every `/caregiver/*` subpage embeds **`CaregiverPatientBar`** (`src/components/caregiver/CaregiverPatientBar.tsx`), letting multi-patient caregivers switch patients persistently (`localStorage`) or immediately generate a `6-digit` pairing code when no patient is paired yet.

1. **`/caregiver` — Caregiver Hub (`src/app/caregiver/page.tsx`):**
   - Header with Settings link, paired patient count, and manual **`Sync All`** button (`useSync`, displays pending offline record count).
   - **Patient's Today:** Live hydration consumed (`L`) and daily medications marked `TAKEN`.
   - **8 Feature Tiles (Responsive Grid):** Links to all 8 subpages below.
   - **Care Circle Snapshot & Cognitive Accuracy Chart (`recharts` `LineChart`).**
   - **Health & Vitals Update Form:** Records Weight, Heart Rate, Systolic/Diastolic BP, Appetite, Sleep, and Behavioral Notes to `POST /vitals` (`kind: VITAL` & `REPORT`).
   - **Add to Memory Scrapbook Upload Card:** Uploads photos/stories straight to `POST /scrapbook`.
2. **`/caregiver/routines`:** Add/delete daily routines (`9` categories, `HH:MM` time, optional Care Circle assignee, optional attached `MediaRecorder` voice reminder). Syncs to patient's Home `NowCard` & `PlannerTimeline`.
3. **`/caregiver/wellbeing`:** Displays latest wellbeing check-in, 7-day color-coded trend matrix, **`Export CSV`** download, and **Add Caregiver Observation** form (`0..3` ratings + notes).
4. **`/caregiver/circle`:** Lists Care Circle members (`Edit` role / `Revoke` access), **`Invite`** modal generating 6-digit pairing codes, and shared Care Updates feed (`POST /care-updates`).
5. **`/caregiver/safety`:** Live Patient Location Status badge (`SAFE`, `OUTSIDE ZONE`, `AWAITING LOCATION`, stale warning >15 mins), interactive OpenStreetMap map (`MapView.tsx` using `react-leaflet`), **Add Safe Zone** slider (`50m–1000m`), delete zone confirm, and geofence enter/exit history (`/safety`).
6. **`/caregiver/voice`:** Standalone recorder to capture, preview, and attach personal family voice reminders by routine type (`medication`, `hydration`, `meal`, `exercise`, `custom`) and `HH:MM`.
7. **`/caregiver/family`:** Upload photos + record/upload voice clips for family members (`FamilyAsset`), directly powering the `Guess the Faces` and `Whose Voice?` memory games.
8. **`/caregiver/resources`:** Search/filter NER services by category and toggle **`Save to Plan`** bookmarks for the active patient.
9. **`/caregiver/settings`:** Edit Caregiver name/phone, paired patient emergency phone & language, **`Export Patient Records (JSON)`**, confirmed **`Clear Local Browser Cache`**, honest RBAC privacy notice, and **`Sign Out`**.

---

### C. Clinician / Doctor Portal (`/doctor`)

- **Header Actions:** **`Assign Patient`** form (links patient via email + caregiver 6-digit code via `POST /api/clinician/patients`), **`Export CSV`** (downloads timeline), **`Print Report`** (`window.print()`), and **`Sign Out`**.
- **Patient Banner:** Patient dropdown switcher, demographics (`Blood Group`, `Allergies`, `Emergency`, `Language`), non-diagnostic indicator badge (`Low` / `Moderate` / `Elevated` / `Insufficient Data`), and explicit Supportive Care Disclaimer banner.
- **5 Clinical Tabs:**
  1. **Overview:** Latest vitals tiles (`Weight`, `BP`, `HR`, `Rule Indicator`) + recent Caregiver Observations.
  2. **Vitals & Trends:** Longitudinal Weight (`AreaChart`) and Systolic/Diastolic Blood Pressure (`LineChart`).
  3. **Prescriptions (`Rx`):** Create new prescriptions (`name`, `dosage`, `frequency`, `time`, `instructions`) and toggle `ACTIVE` <-> `DISCONTINUED` (`POST / PATCH /api/patients/[id]/medications/manage`), syncing directly onto the Patient's daily planner.
  4. **Timeline:** Unified chronological feed merging Medications, Hydration, Vitals, Caregiver Reports, and Cognitive Sessions (`GET /timeline`).
  5. **Engagement Analytics:** Rule-based statistical summary from `POST /api/predict` (mean move latency, error average, 7-day medication adherence) + Cognitive Game Accuracy `BarChart`.

---

## 5. Technical, Database, AI & Security Summary

- **Frontend Stack (`package.json`):** Next.js `14.2.35` (App Router, `33` page routes), React `18`, Tailwind CSS `3.4.1`, Framer Motion `13.2.0`, Lucide React `1.40.0`, Recharts `3.10.1`, React-Leaflet `4.2.1`, Dexie `4.4.5` (`IndexedDB`). PWA powered by `next-pwa` `5.6.0` (`public/manifest.json`, `/offline` fallback, `/api/.*` excluded via `NetworkOnly`).
- **Database (`prisma/schema.prisma`):** Currently SQLite (`file:./dev.db`) during local development (`32` models total):
  - **Identity & Access (`7`):** `User`, `PatientProfile`, `CaregiverProfile`, `ClinicianProfile`, `PatientCaregiver`, `CareCircleMember`, `PairingInvitation`
  - **Health, Meds & Check-Ins (`9`):** `Medication`, `MedicationEvent`, `HydrationTarget`, `HydrationEvent`, `VitalLog`, `SleepRecord`, `ActivityRecord`, `MoodRecord`, `WellbeingEntry`
  - **Routines, Voice & Safety (`6`):** `DailyRoutine`, `RoutineOccurrence`, `VoiceReminder`, `SafeZone`, `LocationPing`, `LocationEvent`
  - **Family, Reminiscence & Community (`5`):** `CareUpdate`, `FamilyAsset`, `ScrapbookEntry`, `LocalResource`, `SavedResource`
  - **Cognitive, Content & Audit (`5`):** `CognitiveSession`, `HealthScore`, `ContentItem`, `CaregiverReport`, `AuditLog`
  - PostgreSQL production migration blueprint lives in `docs/SMRITI_DEPLOYMENT_PLAN.md`.
- **Core API Surface (`25` App Router endpoints under `src/app/api/`):**
  - Auth & Identity: `/api/auth/register`, `/api/auth/[...nextauth]`, `/api/profile`, `/api/pairing`
  - Portals & Sync: `/api/caregiver/patients`, `/api/care-circle`, `/api/clinician/patients`, `/api/sync`, `/api/content`, `/api/resources`, `/api/alert`, `/api/chat`, `/api/predict`
  - Patient Sub-Resources (`/api/patients/[patientId]/...`): `medications`, `medications/manage`, `hydration`, `routines`, `vitals`, `wellbeing`, `cognitive`, `timeline`, `safety`, `care-updates`, `family-assets`, `scrapbook`
- **Voice & AI Stack:**
  - **Conversational AI (`POST /api/chat`):** Verified RBAC-authorized patient context retrieval (`10` recent timeline events via `TimelineService.getUnifiedTimeline` + today's water total) -> calls Groq Chat Completions API (`openai/gpt-oss-20b`, language-aware instruction across the `16` `LANGUAGES` entries) with deterministic medication/water/offline fallback.
  - **Voice Interaction (`ConversationalUI` & `VoiceAssistantProvider`):** Browser `SpeechSynthesis` + `SpeechRecognition` mapped across `LANGUAGES` (`en-IN`, `as-IN`, `bn-IN`, `mni-IN`, `ne-NP`, falling back gracefully to keyboard input & `en-IN`).
  - **Rule-Based Engine (`src/lib/ai-difficulty.ts` & `POST /api/predict`):** Heuristic difficulty tuning (`1..10`) and transparent non-diagnostic statistical trend indicator (`Low` / `Moderate` / `Elevated` / `Insufficient Data`).
- **Configured Security Controls:** NextAuth signed JWTs, `bcryptjs` (`12` rounds) passwords, fail-closed `RBAC` & `src/middleware.ts`, Twilio SMS SOS lookup (`CAREGIVER_PHONE_NUMBER` / paired profile), CSP + `X-Frame-Options` + `X-Content-Type-Options` + `Referrer-Policy` + `Permissions-Policy` HTTP headers, automated test scripts (`npm test`, `npm run test:e2e`).

---

## 6. Everything We Can Make Better (Priority Roadmap for an iOS-Inspired, Icon-First, Encrypted, Free Dementia App)

### 6.1 iOS-Inspired, Uncluttered, Icon-First UI/UX Redesign ("More Icony, Fewer Words")

Right now, the UI is cleanly structured functionally, but an elderly user with moderate dementia visiting `/` or `/games` still sees **scrollable vertical stacks of text-heavy cards**, small icons alongside multi-line descriptions, and standard web controls. To feel truly like a **calm Apple iOS Health / Assistive Access interface**:

1. **Patient Home ("Assistive 4-Tile Mode" — Zero Scroll Clutter):**
   - Instead of 7–8 vertically stacked cards, redesign `/` around **1 Giant Context Tile + 4 Chunky iOS Squircle Tiles** (`min-height: 110px–130px`, crisp `48px` vector icons + 1–2 word caption, optional 1-tap speaker icon):

```text
+-------------------------------------------------------------------+
| RECOMMENDED APPLE iOS ASSISTIVE PATIENT HOME                      |
| [ Hold 3s / PIN: Caregiver Lock ]   [ Family Photo: Call ] [SOS]  |
|                                                                   |
|   ☀️ Good Morning, Didi    [ 🔊 Listen ]                          |
|   [ 🎙️ Tap & Speak in Assamese / Bodo / Meitei / English ]        |
|                                                                   |
| +---------------------------------------------------------------+ |
| | ⏰ RIGHT NOW • 8:00 AM                                        | |
| |   [ Photo of Pill Strip ]   Morning Blue Pill                 | |
| |   [    ✅ I TOOK IT (Giant Green)    ]   [ ⏱️ Later ]         | |
| +---------------------------------------------------------------+ |
|                                                                   |
| +-------------------------------+ +-----------------------------+ |
| |       💧                      | |       🧩                    | |
| |   DRINK WATER                 | |   PLAY GAME                 | |
| |  (Animated Liquid Ring 3/8)   | |  (1-Tap Today's Exercise)   | |
| +-------------------------------+ +-----------------------------+ |
| +-------------------------------+ +-----------------------------+ |
| |       📖                      | |       🏥                    | |
| |   FAMILY BOOK                 | |   HELP / FAMILY CALL        | |
| |  (Photos + Loved Voices)      | |  (Tap Face to Call + 108)   | |
| +-------------------------------+ +-----------------------------+ |
|                                                                   |
| [ Frosted Glass Tab Bar: 🏠 Today | 🧩 Games | 📖 Family ]         |
+-------------------------------------------------------------------+
```

   - **Top Hero ("Right Now"):** Single next due item (e.g., pill photo + `"Morning Pill • 8:00 AM"`) with ONE giant emerald **`Done`** button and ONE soft **`Later`** button — nothing else competing for attention.
   - **2x2 Icon Grid:**
     1. **`💧 Drink Water`** (`+1 Glass` right on tap, big liquid ring filling up visually like Apple Fitness rings!)
     2. **`🧩 Play Game`** (Launches today's recommended gentle game immediately without picking from 14 cards first, with a tiny secondary link for `"All Games"`)
     3. **`📖 Family Book`** (Opens photos & voices of loved ones)
     4. **`🏥 Help / Family Call`** (Opens Big Photo Speed-Dial + `108` / `112`)
2. **One-Tap Family Photo Speed-Dial (Replacing Text SOS Alone):**
   - Dementia patients recognize **faces faster than names or numbers**. Replace generic SOS text modals with **large circular portraits of Daughter / Son / Caregiver** (`"Tap face to call"` using `tel:` link + parallel `/api/alert` SMS ping).
3. **Typography, Tap Targets & Haptic-Feel Apple Polish:**
   - Standardize **minimum `56px × 56px` touch targets** everywhere on patient views, `18px–22px` base body copy, bold `SF Pro`-style vertical rhythm, translucent frosted iOS cards (`backdrop-blur-xl bg-white/85`), and full **`prefers-reduced-motion`** toggle (critical because bouncy animations can disorient some elders).
   - Remove English jargon buttons (`"UNSYNCED"`, `"SYNC ALL"`, `"VITALS"`, `"RX"`) from any patient-reachable view; keep clinical/sync vocabulary strictly inside Caregiver/Doctor portals.
4. **Shared-Tablet Caregiver Lock (4-Digit Caregiver PIN / Hold-to-Unlock):**
   - In many NER households, the elderly parent and family caregiver share one Android tablet or phone. Add a **`Patient Lock / Guided Access Mode`** where exiting Patient Mode or opening `/profile` & Caregiver menus requires a 4-digit Caregiver PIN or `"Press & hold 3 seconds"` guard so a confused patient never accidentally signs out or changes settings.
5. **Visual Pill Recognition & Guided Pictorial Checklists:**
   - Let caregivers snap a **photo of each actual tablet/strip** (adding an `imageUrl` field to `Medication`) so `NowCard` displays the *picture of the pill* beside the time (`Morning after food` sun/plate icon) — vastly safer and more intuitive than drug names like `"Donepezil 5mg"`.

---

### 6.2 Stronger Data Safety & Real End-to-End Encryption

Today, passwords are hashed (`bcryptjs`), APIs check RBAC, and transport in production relies on HTTPS (`TLS`), **but** database columns in SQLite and browser offline rows in `IndexedDB` are stored as readable fields (and `crypto-js` in `src/lib/security.ts` is only an explicit helper). To make patient data genuinely safe for real families:

1. **Server-Side Envelope Field Encryption (`AES-256-GCM`):**
   - Encrypt sensitive clinical columns at rest (`PatientProfile.diagnoses`, `allergies`, `emergencyContact`, `CaregiverReport.notes`, `WellbeingEntry.notes`, `LocationPing` coordinates) using Node `crypto` `aes-256-gcm` with a server-only key (`ENCRYPTION_MASTER_KEY` / KMS) before saving to Postgres.
2. **True Client-Side Offline Cache Encryption (`WebCrypto`):**
   - Replace plaintext Dexie fields for offline medical/location data with `WebCrypto` AES-GCM encrypted payloads whose session key is unlocked on sign-in (and wiped immediately on **`Sign Out`** or **30-minute idle timeout**), so sensitive health records cannot be read from browser DevTools on shared family devices.
3. **Move Media Out of Base64 Database Strings:**
   - Currently photos (`ScrapbookEntry`, `FamilyAsset`) and voice clips (`VoiceReminder`) store Base64 strings up to several megabytes inside SQLite rows and IndexedDB. Move media uploads to **private object storage (Supabase Storage or Cloudflare R2)** with short-lived **signed URLs** verified by RBAC and client-side image compression (`<= 250 KB` WebP) before upload.
4. **Managed PostgreSQL Migration & Automated Backups:**
   - When authorized for deployment, migrate `prisma/schema.prisma` from local `sqlite` to managed PostgreSQL (`Neon` or `Supabase`) with automated point-in-time backups, SSL-enforced DB connections, and read-only audit logging (`AuditLog`) capturing exports, views, and role changes.
5. **Security & Session Hardening:**
   - Tighten Next.js `CSP` (replace `'unsafe-inline'`/`'unsafe-eval'` script allowances with per-request **cryptographic nonces**), add **refresh/idle session lock**, add Redis/Edge rate-limiting on `/api/auth/register`, `/api/pairing`, and `/api/alert`, and add explicit **Consent & Data Deletion ("Delete My Account & Data")** controls under `/profile` and `/caregiver/settings`.

---

### 6.3 Genuine NER Regional Languages, Voice-First Assistance & Cultural Warmth

1. **Voice-First Spoken Control (Zero Reading Required):**
   - Many elderly elders in NER speak Assamese, Bodo, Meitei, Khasi, Mizo, Garo, Nyishi, Adi, Nepali, Kokborok, or Nagamese comfortably even when they cannot easily read small English UI text.
   - Integrate **Bhashini API** (MeitY Government of India speech-to-text, neural machine translation, and regional text-to-speech) server-side once API keys are provisioned, backed by an optional **Whisper (`Groq` free tier) / Vosk offline speech recognizer** (`MediaRecorder` -> `/api/voice`) for browsers/WebViews where Web Speech `SpeechRecognition` lacks regional locales.
2. **Verified Native Community Translations (Zero Incomplete Locales):**
   - Right now `src/lib/translations.ts` has verified full coverage in English (`247/247` keys in `TranslationStrings`) and partial scripts in Assamese/Bengali/Meitei/Nepali, while several NER tribal dialects fall back to English or short starter maps.
   - Split translations into lazy-loaded JSON files (`src/locales/*.json`) to trim client bundle weight and collaborate with native NER speakers to translate the ~50 core patient-facing strings cleanly (greeting, water, pill, yes/no, call family, check-in, game prompts).
3. **Culturally Anchored NER Reminiscence Content & Audio:**
   - Add richer bundled public-domain/illustrated NER cultural packs beyond `NER_ASSAM_PACK`: Assam (Bihu dhol, gamosa, tea gardens, Kaziranga, Brahmaputra ferry), Meghalaya (living root bridges, bamboo craft), Manipur (Loktak phumdis, Lai Haraoba), Nagaland (traditional shawl weaves), Sikkim (Himalayan monasteries, prayer flags), plus short gentle instrumental folk audio loops in `/scrapbook`.

---

### 6.4 Keeping Everything 100% Free to Deploy & Maintain

| Component | Free Production Choice | Why It Fits Smriti |
| :--- | :--- | :--- |
| **App Hosting** | **Cloudflare Pages (OpenNext)** or **Vercel Hobby** (personal/NGO pilot) | `$0/mo` with automatic HTTPS and global CDN |
| **Database** | **Neon Serverless Postgres** (`0.5–1 GB` free) | Doesn't expire after 30 days; generous free compute |
| **File Storage** | **Cloudflare R2** (`10 GB` free) or **Supabase Storage** (`1 GB` free) | Eliminates heavy Base64 strings from DB |
| **AI Companion** | **Groq Free Tier** + deterministic local rule fallback | Zero cost up to rate limit; works offline for water/med queries |
| **Regional Voice** | **Browser Web Speech API** + **MeitY Bhashini API** | Free Indian government DPI for regional ASR/TTS |
| **Maps & Weather** | **OpenStreetMap + Leaflet** & **Open-Meteo** | Completely key-free and cost-free |
| **Alerts & Push** | **Standard Web Push (VAPID) + `tel:` Direct Dial** | Zero per-SMS Twilio cost unless family explicitly wants SMS fallback |

---

### 6.5 High-Value Caregiver & Clinical Upgrades

1. **Free Push Notifications (`VAPID` Service Worker Push):** Alert caregivers immediately when a loved one exits a Safe Zone or misses a critical morning medication — without requiring paid Twilio SMS credits.
2. **Printable Large-Print Pictorial Wall Routine (`PDF`):** Let families click **`Print Kitchen Wall Schedule`** on `/caregiver/routines` to print an A4 illustrated card with clock icons, meal icons, pill photos, and emergency phone numbers for homes without all-day phone usage.
3. **Interactive Visual Guided Setup (3-Step First-Time Wizard):** When a caregiver signs up cleanly, walk them visually through: `(1) Pair Patient 6-Digit Code -> (2) Add 2 Essential Daily Routines -> (3) Add 1 Family Photo & Phone`, preventing empty dashboards.
4. **Offline-First Bi-Directional Sync Reconciliation:** Upgrade `/api/sync` from append-only batch push (`POST`) to delta pull+push with client `clientMutationId` idempotency keys so reconnecting after hours offline in rural NER never duplicates water/routine logs.
