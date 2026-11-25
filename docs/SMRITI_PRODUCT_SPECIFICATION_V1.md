# SMRITI
## Definitive Product Specification
**Product:** Smriti-NER  
**Specification:** v1.0  
**Status:** Approved product direction, pending technical validation  
**Platform:** Offline-first Progressive Web Application  
**Primary Region:** India's North Eastern Region

---

# 1. Product Definition

## 1.1 Vision

Smriti is an AI-powered, voice-first memory companion and care coordination platform designed for people experiencing dementia, mild cognitive impairment, age-related memory difficulties, and other memory-related challenges.

It helps individuals maintain familiar daily routines, interact with loved ones, access personal memories, participate in cognitive activities, and receive assistance through natural voice interaction.

At the same time, it gives caregivers tools to coordinate daily care, manage routines, preserve personal memories, monitor wellbeing, and communicate with healthcare professionals.

Smriti is designed around three principles:

1. **Independence:** Make everyday interactions easier for the person receiving care.
2. **Connection:** Preserve relationships, familiar experiences and personal identity.
3. **Continuity:** Keep essential functionality available even without internet access.

## 1.2 Product positioning

Smriti is not:
- A diagnostic dementia application.
- A replacement for doctors or professional caregivers.
- A conventional health-tracking dashboard.
- A generic AI chatbot.
- A surveillance application.

Smriti is a personal memory and daily-life companion supported by a family care coordination system.

## 1.3 Target users

Primary:
- Elderly people experiencing dementia.
- People with mild cognitive impairment.
- People experiencing age-related memory difficulties.
- Individuals who benefit from reminders, familiar visual cues and assisted communication.

Secondary:
- Family caregivers.
- Professional caregivers.
- Authorized family members.
- Healthcare professionals.

Geographic focus:
- Assam.
- Meghalaya.
- Manipur.
- Nagaland.
- Mizoram.
- Arunachal Pradesh.
- Tripura.
- Sikkim.

## 1.4 Non-negotiable principles

- No diagnosis or treatment recommendations.
- No fabricated personal memories.
- No unnecessary collection of personal data.
- No unauthorized access across patient profiles.
- No essential patient functionality dependent exclusively on AI.
- No loss of locally recorded information during synchronization.
- No paid subscription requirement for essential family features as a product objective.
- Patient dignity, privacy and safety take priority over engagement metrics.

---

# 2. Approved Product Decisions

These decisions define the product direction and should not be silently changed by implementation agents.

| Decision | Approved direction |
|---|---|
| Patient interface | Three selectable complexity modes |
| Visual identity | Friendly illustrated and playful, but age-respectful |
| AI companion | Core voice-first companion |
| AI conversation style | Both natural conversation and task-focused assistance |
| Patient account | Created by caregiver |
| Patient settings | Managed by caregiver |
| Family experience | Integrated into patient and caregiver applications |
| Offline support | Offline-first with online synchronization |
| Regional languages | All eight NER states covered from the beginning |
| AI failure | Basic voice commands and non-AI functionality continue |

---

# 3. Application Roles and Permissions

Smriti has three primary application roles and a shared family participation system.

## 3.1 Patient

The patient uses the application through a simplified, accessible experience.

Capabilities:
- Interact with the Smriti Companion.
- View daily routines.
- Receive reminders.
- Record hydration and daily activities.
- Access cognitive games.
- View photographs and personal memories.
- Listen to family voice recordings.
- Contact authorized family members.
- Access emergency assistance.
- Complete optional wellbeing check-ins.

Patients should not need to understand technical terminology or navigate complex settings.

## 3.2 Caregiver

The caregiver creates and administers the patient's application account.

Capabilities:
- Create patient profiles.
- Configure patient settings.
- Select the patient's interface complexity.
- Configure language and voice preferences.
- Manage daily routines.
- Configure medication reminders from verified instructions.
- Manage hydration preferences.
- Upload family photographs and recordings.
- Manage family access.
- Configure emergency contacts.
- Configure optional location sharing and safe zones.
- Review wellbeing and activity history.
- Export authorized patient information.
- Manage offline synchronization.
- Manage account recovery and access.

Caregiver administration does not grant unrestricted authority over every category of information.

In particular:
- Medication prescriptions must retain appropriate clinical authorization.
- Caregivers can record medication administration without independently changing prescribed treatment.
- Clinician access must be explicitly authorized.
- Sensitive information must remain protected from unrelated family members.
- Patient consent, assent, dignity and applicable representative-authority requirements must be respected.

## 3.3 Clinician

The clinician receives access only to explicitly authorized patients.

Capabilities:
- Review patient information.
- Review vitals and historical observations.
- Manage authorized prescription records.
- Review caregiver observations.
- Review cognitive engagement history.
- Generate reports.
- Review longitudinal patient timelines.

Smriti must never represent engagement statistics as a clinical dementia diagnosis or severity score.

## 3.4 Family members

Family participation is integrated into the patient and caregiver applications rather than requiring a fourth independent application.

Capabilities depend on permissions assigned by the caregiver:
- Upload approved photographs.
- Contribute personal stories.
- Record voice greetings.
- Participate in the Care Circle.
- Receive authorized care updates.
- Contact the patient through approved communication options.

Family membership must not automatically provide access to medical records, location history or sensitive caregiver notes.

---

# 4. Patient Experience

## 4.1 Three complexity modes

The patient interface must support three selectable modes.

### Mode A: Simple

Intended for people who need substantial assistance.

Design:
- Three or four primary actions.
- Large illustrations.
- Minimal text.
- Very large touch targets.
- Spoken instructions.
- Minimal navigation.
- One primary action at a time.

Primary areas:
1. Today.
2. Play.
3. Family.
4. Help.

The next scheduled activity should be displayed prominently.

### Mode B: Guided

Intended for people who can navigate familiar interactions with some assistance.

Includes:
- Everything in Simple Mode.
- Daily routines.
- Medication and hydration reminders.
- Cognitive games.
- Family memories.
- More detailed activity navigation.
- Optional voice guidance.

### Mode C: Full

Intended for people who can independently navigate more of the application.

Includes:
- Full patient feature access.
- Activity history.
- More game choices.
- More personalization.
- Detailed routine navigation.
- Expanded AI companion interactions.

### Mode management

The caregiver manages the selected complexity mode.

Requirements:
- Switching modes must not delete patient data.
- Switching modes must not modify clinical information.
- All modes must share the same underlying patient profile.
- A patient must not be trapped in an inaccessible interface.
- Accessibility settings must remain consistent across modes.

## 4.2 Patient home

The home screen is the primary patient interface.

It should contain:

1. Friendly greeting.
2. Smriti Companion voice interaction.
3. Next scheduled activity.
4. Four primary visual actions.
5. Emergency and family contact access.

Proposed four primary actions:
- Drink Water.
- Play.
- Family Memories.
- Call Family / Get Help.

The next scheduled item should be displayed as one prominent context card.

Weather, detailed analytics, maps, clinical data, synchronization terminology and complicated settings should not compete for attention on the default patient home.

## 4.3 Daily routines

The patient receives a visual representation of their daily schedule.

Example:
- Wake up.
- Brush teeth.
- Breakfast.
- Medicine.
- Walk.
- Lunch.
- Rest.
- Family time.
- Dinner.
- Sleep.

Each activity may include:
- Illustration.
- Short description.
- Scheduled time.
- Optional recorded family voice instruction.
- Completion action.
- Snooze action where appropriate.

Caregivers configure the schedule.

## 4.4 Medication reminders

Requirements:
- Display medication reminders at configured times.
- Support caregiver-recorded medication instructions.
- Display a caregiver-approved medication photograph where appropriate.
- Play an optional voice reminder.
- Allow the patient to report that medication was taken.
- Allow a reminder to be postponed.
- Record the source and timestamp of each event.

Patient-reported medication intake must remain distinguishable from caregiver-confirmed administration.

The application must never independently change medication dosage or frequency.

## 4.5 Hydration

Requirements:
- Configurable patient-specific hydration target.
- Visual progress display.
- One-tap water logging.
- Undo for accidental entries.
- Offline event recording.
- Caregiver review.

A universal 2,000 ml target must not be treated as medically suitable for everyone.

## 4.6 Wellbeing check-in

The existing six areas remain part of the product baseline:
- Mood.
- Sleep quality.
- Confusion level.
- Energy level.
- Pain level.
- Overall wellbeing.

Improvements:
- One question at a time.
- Large visual response options.
- Spoken questions.
- Optional completion.
- Ability to skip a question.
- Voice-assisted interaction.
- Clear indication of whether a response was patient-reported or caregiver-reported.

Check-ins must not become an intrusive or compulsory daily test.

---

# 5. Smriti Companion: Voice-First AI

## 5.1 Product role

The Smriti Companion is a central interaction layer, not merely a chatbot.

It helps patients interact with the application's existing features through conversation and simple voice commands.

## 5.2 Two interaction styles

### Conversational mode

Friendly, natural conversation.

Examples:
- Greeting the patient.
- Talking about familiar memories.
- Responding to everyday conversation.
- Offering reassurance.
- Helping the patient navigate familiar activities.

### Task-focused mode

Short, direct assistance.

Examples:
- "Show me my family."
- "What do I do next?"
- "Play a memory game."
- "Call my daughter."
- "Tell me when my medicine is due."
- "Read my routine."

The system should adapt its response length and interaction style to the patient's needs and configured preferences.

## 5.3 AI capabilities

- Speech-to-text.
- Intent recognition.
- Context-aware assistance.
- Permission-checked application actions.
- Text-to-speech.
- Language-aware responses.
- Patient-specific routine retrieval.
- Approved family memory retrieval.
- Reminder assistance.
- Accessible navigation.

## 5.4 AI action safety

The AI must not:
- Invent family relationships or personal memories.
- Claim that a medication was taken without a recorded event.
- Change prescriptions.
- Diagnose or recommend treatment.
- Reveal information belonging to another patient.
- Trigger sensitive actions without appropriate confirmation.
- Impersonate a family member.
- Pretend to have contacted emergency services when no delivery confirmation exists.

AI-generated content must be distinguishable from stored personal information.

## 5.5 AI architecture

Proposed pipeline:

Speech Input -> Speech Recognition -> Language and Intent Detection -> Patient Context Retrieval -> Permission Validation -> Action or Response -> Speech Output.

The AI provider must be replaceable.

The application must not become dependent on one model provider.

## 5.6 AI failure and offline fallback

When the AI provider is unavailable:
- Patient home remains usable.
- Cognitive games remain usable.
- Cached memories remain accessible.
- Daily routines remain available.
- Medication reminders remain available where local scheduling permits.
- Hydration logging continues.
- Basic deterministic voice commands continue where a compatible offline speech engine is installed.
- Visual controls remain available.
- Previously cached audio remains accessible.

Do not claim offline speech recognition for a language unless its local model has been tested.

If speech recognition is unavailable, the patient must still be able to use the application through large visual controls.

---

# 6. Family and Personal Memories

## 6.1 Personal memory system

The existing scrapbook becomes a broader personal memory experience.

Supported content:
- Family photographs.
- Names and relationships.
- Personal stories.
- Important life events.
- Familiar locations.
- Recorded greetings.
- Family voice messages.
- Important dates.
- Cultural and personal experiences.

Each memory should have:
- Unique identifier.
- Patient identifier.
- Title.
- Description.
- Media reference.
- Contributor.
- Creation timestamp.
- Language.
- Access permissions.

## 6.2 Family recognition

The application may display approved family photographs and associated names.

The family must verify the accuracy of the names and relationships.

Do not automatically infer identity from a photograph.

## 6.3 Family communication

Requirements:
- One-tap calling for approved contacts.
- Large contact photographs.
- Clear relationship labels.
- Optional voice greetings.
- Caregiver-controlled contact permissions.
- Protection against accidental calls.

## 6.4 Memory games

Approved family assets should be available to:
- Guess the Faces.
- Recognize Voices.
- Memory Match.
- Other suitable personalized activities.

The caregiver controls which photographs and recordings are available to the patient.

---

# 7. Cognitive Activities

The existing 14-game inventory is retained as the baseline:

1. Guess Faces.
2. Recognize Voices.
3. Memory Match.
4. Color Sequence.
5. Pattern Weave.
6. Find the Item.
7. Odd One Out.
8. Shadow Match.
9. Daily Routine.
10. Sorting Game.
11. Object Recognition.
12. Word Association.
13. Word Garden.
14. Emotion Recognition.

Requirements:
- Adaptive difficulty.
- Gentle instructions.
- Replay support.
- No punitive failure states.
- Optional timers.
- Accessible controls.
- Cultural personalization.
- Offline operation.
- Local activity recording.
- Synchronization when online.

Cognitive telemetry may include:
- Activity type.
- Completion.
- Accuracy.
- Errors.
- Reaction time.
- Difficulty.
- Timestamp.

These measurements represent application engagement and must not be interpreted as a standalone clinical diagnosis.

---

# 8. Regional Languages and Cultural Personalization

## 8.1 Launch requirement

All eight North Eastern states must be represented in the initial product language and localization architecture.

The product must not be designed around English alone and translated as an afterthought.

## 8.2 Initial language coverage framework

The following are proposed starting language packs, not a declaration that each state has only one language.

| State | Initial language candidate |
|---|---|
| Assam | Assamese |
| Meghalaya | Khasi |
| Manipur | Meitei |
| Nagaland | A community-selected Naga language, with Nagamese considered separately |
| Mizoram | Mizo |
| Arunachal Pradesh | Nyishi |
| Tripura | Kokborok |
| Sikkim | Nepali |

Additional languages must be supported through an extensible localization system.

Language selection must be configurable by the caregiver.

## 8.3 Localization requirements

Every language pack should support:
- Navigation labels.
- Patient instructions.
- Daily routine vocabulary.
- Medication reminders.
- Hydration prompts.
- Game instructions.
- Family interaction labels.
- Emergency instructions.
- AI responses where supported.
- Speech recognition where supported.
- Speech synthesis where supported.

## 8.4 Translation quality

Machine translation alone is not sufficient for safety-critical patient instructions.

Requirements:
- Native-speaker review.
- Community validation.
- Consistent terminology.
- Correct script rendering.
- Audio pronunciation review.
- Translation versioning.
- Fallback language selection.

The application must clearly identify when a requested language or voice capability is unavailable.

## 8.5 Regional content

Develop optional cultural content packs for:
- Familiar objects.
- Food.
- Landscapes.
- Traditional clothing.
- Music and festivals.
- Local architecture.
- Everyday activities.

Content should be selected based on patient and family preferences, not assumptions about regional identity.

---

# 9. Caregiver Application

## 9.1 Caregiver home

The caregiver dashboard should be organized around daily care rather than a collection of unrelated feature cards.

Primary sections:

1. Today's Care.
2. Patient Wellbeing.
3. Routines and Reminders.
4. Family and Care Circle.
5. Safety.
6. Reports and Settings.

## 9.2 Today's Care

Display:
- Medication events.
- Hydration entries.
- Scheduled activities.
- Completed routines.
- Pending reminders.
- Patient check-in status.
- Recent observations.
- Synchronization status.

Each event must show its source and timestamp.

## 9.3 Routines

Requirements:
- Create and edit routines.
- Assign scheduled times.
- Attach voice recordings.
- Configure recurrence.
- Assign authorized family participants.
- Review completion history.
- Print pictorial routines.

## 9.4 Wellbeing

Requirements:
- Review patient check-ins.
- Record caregiver observations.
- Review seven-day history.
- Export authorized information.
- Distinguish patient and caregiver reports.

## 9.5 Care Circle

Requirements:
- Invite family members.
- Assign permissions.
- Revoke access.
- Display participation history.
- Share authorized updates.

## 9.6 Safety

Requirements:
- Optional location sharing.
- Configurable safe zones.
- Last known location.
- Location timestamp.
- Location accuracy.
- Stale-location warning.
- Geofence event history.
- Caregiver alerts where supported.

A location status must never imply guaranteed physical safety.

## 9.7 Family assets

Requirements:
- Upload photographs.
- Upload voice recordings.
- Record family greetings.
- Assign names and relationships.
- Configure patient visibility.
- Delete or replace content.
- Store media securely.

## 9.8 Caregiver settings

Include:
- Patient profile configuration.
- Language preferences.
- Complexity mode.
- Voice settings.
- Emergency contacts.
- Privacy settings.
- Data export.
- Account management.
- Local cache management.
- Access management.

---

# 10. Clinician Application

The existing five-tab architecture remains the proposed foundation.

## Overview
- Patient summary.
- Latest measurements.
- Recent observations.
- Relevant alerts.

## Vitals and Trends
- Historical measurements.
- Weight.
- Blood pressure.
- Heart rate.
- Other supported measurements.

## Prescriptions
- Authorized prescription creation.
- Dosage and frequency.
- Instructions.
- Active and discontinued status.
- Medication history.

## Timeline
- Medication events.
- Hydration events.
- Vitals.
- Caregiver observations.
- Wellbeing records.
- Cognitive activity sessions.

## Engagement Analytics
- Activity completion.
- Accuracy.
- Reaction time.
- Historical engagement.

All analytics must remain non-diagnostic unless separately validated and authorized for a specific clinical use.

---

# 11. Visual Identity and Design System

## 11.1 Identity

Friendly, illustrated, playful and age-respectful.

Smriti must feel familiar, warm and human without looking like a children's application.

## 11.2 Design characteristics

- Soft pastel palette.
- Warm neutral backgrounds.
- Rounded visual surfaces.
- Recognizable illustrations.
- Friendly companion mascot.
- Large, clear typography.
- Consistent visual vocabulary.
- Gentle animations.
- Minimal visual clutter.
- High contrast for important actions.

## 11.3 Proposed design foundations

Existing palette:
- Warm background: `#FDFBF7`.
- Primary foreground: `#2D3748`.
- Mint.
- Peach.
- Lavender.
- Sky.
- Amber.
- Rose.

Typography should prioritize readability rather than imitate a particular operating system.

## 11.4 Accessibility

Requirements:
- Minimum `56px` touch targets on primary patient controls.
- Base patient body text generally `18–22px`.
- Scalable text.
- Screen-reader compatibility.
- Keyboard accessibility.
- Reduced motion.
- High contrast option.
- Clear focus indicators.
- Consistent placement of controls.
- Large error recovery actions.
- No color-only communication of status.

The application must be tested with Android accessibility services and relevant screen readers.

---

# 12. Offline-First Architecture

## 12.1 Principle

Offline capability is a foundational architectural requirement.

It must not be treated as an optional enhancement.

## 12.2 Local capabilities

The application should support offline:
- Patient home.
- Daily routines.
- Cached reminders.
- Cognitive games.
- Previously downloaded memories.
- Family voice recordings.
- Hydration logging.
- Wellbeing entries.
- Patient profile information required for the active session.
- Locally available language assets.
- Supported local voice commands.

## 12.3 Proposed architecture

Frontend:
- Next.js application.
- React.
- PWA service worker.
- IndexedDB.
- Dexie local data layer.

Backend:
- Authenticated API.
- Authorization and patient access validation.
- Central application services.
- PostgreSQL production database.
- Private media storage.
- AI and speech integrations.

Synchronization:
- Durable local outbox.
- Client-generated mutation identifiers.
- Server-side idempotency.
- Delta pull and push.
- Conflict detection.
- Retry handling.
- Sync status visibility for caregivers.

## 12.4 Synchronization requirements

Every locally created record must contain:
- Unique identifier.
- Patient identifier.
- Client mutation identifier.
- Creation timestamp.
- Update timestamp.
- Source device identifier.
- Record type.
- Synchronization status.

Important clinical records must never be silently overwritten.

Conflicting medication events, prescription changes and caregiver observations must use explicit reconciliation rules.

## 12.5 Offline security

- Encrypt sensitive local records.
- Protect local media.
- Clear session keys on sign-out.
- Apply inactivity locking.
- Avoid storing unnecessary sensitive information.
- Prevent another household user from accessing a previous patient's local session.

---

# 13. Security and Privacy

## 13.1 Authentication

Existing baseline:
- NextAuth credentials authentication.
- bcrypt password hashing.
- Signed sessions.
- Rate limiting.
- Role-based authorization.

Future requirements:
- Secure account recovery.
- Stronger session lifecycle.
- Secure caregiver-created patient provisioning.
- Appropriate consent records.
- Session revocation.
- Multi-device management.

## 13.2 Authorization

Every patient-specific API request must verify:
1. Authentication.
2. User role.
3. Patient relationship.
4. Requested operation.
5. Required permission.

Never trust a patient ID supplied by the client without server-side authorization.

## 13.3 Encryption

Proposed:
- HTTPS/TLS.
- Database encryption at rest.
- AES-256-GCM envelope encryption for sensitive fields.
- WebCrypto AES-GCM for sensitive offline data.
- Encrypted backups.
- Private object storage.
- Short-lived signed media URLs.

Server-side encryption must not be incorrectly described as end-to-end encryption.

If true end-to-end encryption is later required, key ownership, recovery, sharing and multi-device access must be separately designed.

## 13.4 Privacy controls

- Explicit location-sharing permission.
- Family access permissions.
- Data export.
- Account deletion.
- Data retention policies.
- Consent records.
- Access audit logs.
- Secure media deletion.
- Revocation of caregiver and clinician access.

---

# 14. Data Architecture

The existing Prisma schema contains 32 models grouped into these domains:

## Identity and Access
- User.
- PatientProfile.
- CaregiverProfile.
- ClinicianProfile.
- PatientCaregiver.
- CareCircleMember.
- PairingInvitation.

## Health, Medication and Check-ins
- Medication.
- MedicationEvent.
- HydrationTarget.
- HydrationEvent.
- VitalLog.
- SleepRecord.
- ActivityRecord.
- MoodRecord.
- WellbeingEntry.

## Routines, Voice and Safety
- DailyRoutine.
- RoutineOccurrence.
- VoiceReminder.
- SafeZone.
- LocationPing.
- LocationEvent.

## Family, Memories and Community
- CareUpdate.
- FamilyAsset.
- ScrapbookEntry.
- LocalResource.
- SavedResource.

## Cognitive, Content and Audit
- CognitiveSession.
- HealthScore.
- ContentItem.
- CaregiverReport.
- AuditLog.

The existing model structure is the starting point, not an instruction to preserve every field or relationship unchanged.

Proposed additional architectural requirements:
- Patient interface preferences.
- Localization configuration.
- Consent and authorization records.
- AI interaction safety metadata.
- Notification delivery records.
- Sync mutation tracking.
- Media metadata.
- Device and session management.

Any schema modification requires a migration plan and preservation of existing data.

---

# 15. Technical Baseline and Integrations

## Existing documented stack

- Next.js `14.2.35`.
- React `18`.
- Tailwind CSS `3.4.1`.
- Framer Motion `13.2.0`.
- Lucide React `1.40.0`.
- Recharts `3.10.1`.
- React-Leaflet `4.2.1`.
- Dexie `4.4.5`.
- next-pwa `5.6.0`.
- Prisma.
- SQLite for local development.

The documented implementation includes:
- 33 page routes.
- 32 Prisma models.
- 25 API endpoint groups.
- 14 cognitive games.
- Groq conversational AI integration.
- Browser speech APIs.
- Rule-based difficulty adaptation.

These are documented baseline claims, not independently verified implementation status.

## Proposed future infrastructure

- Managed PostgreSQL.
- Private media storage.
- Reliable offline synchronization.
- Replaceable AI provider.
- Regional speech services.
- Native localization packages.
- Error monitoring.
- Automated backups.
- Security auditing.

## Integration principles

- Prefer open standards.
- Avoid unnecessary paid dependencies.
- Provide fallback behavior.
- Keep provider-specific logic behind replaceable interfaces.
- Never allow third-party AI services to bypass patient authorization.
- Do not transmit sensitive information to external providers unnecessarily.

---

# 16. Emergency and Support Features

The application should provide:
- Emergency contact cards.
- One-tap approved family calls.
- Verified emergency numbers.
- Local healthcare resources.
- Optional caregiver alerts.
- Location-sharing support where enabled.

Emergency directory entries must be verified before production.

A web application cannot guarantee that an SOS notification will be delivered or that an emergency service will respond.

The interface must communicate the actual status of an alert rather than displaying a false success state.

---

# 17. Performance and Reliability

Proposed product requirements:

- Patient home should load quickly on modest Android devices.
- Core patient interactions should work without a network connection after initial setup.
- Game assets should be locally available.
- Media should be compressed appropriately.
- Large language packs should be downloaded selectively where device storage is limited.
- Synchronization should not block patient interactions.
- Failed synchronization should preserve local records.
- Errors should be logged without exposing sensitive patient information.
- Backups must have a tested restoration procedure.

Performance must be evaluated on low-cost Android phones, tablets and unreliable mobile connections, not just modern desktop hardware.

---

# 18. Product Acceptance Criteria

Smriti must not be considered production-ready merely because it builds successfully.

## Patient experience
- All three complexity modes work.
- Patient navigation remains understandable.
- Primary controls meet accessibility requirements.
- All critical actions have clear feedback.
- Patients can use essential features without AI.

## AI companion
- Conversational and task-focused interaction work.
- Patient authorization is enforced for every action.
- AI cannot alter prescriptions.
- AI cannot fabricate personal memories.
- Offline fallback is tested.
- Unsupported language capabilities are communicated honestly.

## Regional localization
- All eight states have an approved initial language pack.
- Critical patient-facing strings have native-speaker review.
- Fonts and scripts render correctly.
- Voice functionality is tested independently per language.
- Language fallback works correctly.

## Caregiver
- Caregivers can create and configure patient accounts.
- Settings are persisted correctly.
- Family permissions work.
- Patient records remain separated.
- Exports contain only authorized information.

## Clinician
- Access is explicitly authorized.
- Clinical records are auditable.
- Prescription permissions are enforced.
- Reports distinguish reported events from verified events.
- Analytics are non-diagnostic.

## Offline
- Games work offline.
- Routines remain available.
- Local records survive reloads and restarts.
- Synchronization does not duplicate events.
- Conflicts are handled safely.
- Local data is protected.

## Security
- Cross-patient access is blocked.
- Session revocation works.
- Sensitive data is protected.
- Media access is authorized.
- Account deletion and data export work.
- Backup restoration is tested.

## Emergency
- Contact numbers are verified.
- Alert delivery status is truthful.
- Failure states are visible.
- Direct calling remains accessible.

---

# 19. Implementation Roadmap

## Phase 0: Technical Validation
- Inspect existing application against this specification.
- Identify reusable features.
- Identify incomplete implementations.
- Validate database and API architecture.
- Evaluate regional language and voice-service feasibility.
- Establish baseline tests.
- Identify destructive migration risks.

## Phase 1: Safety and Foundations
- Caregiver-created patient accounts.
- Permission model.
- Consent and privacy workflows.
- Secure media architecture.
- Patient-specific settings.
- Reliable synchronization foundations.

## Phase 2: Patient Experience
- Three complexity modes.
- Illustrated design system.
- Redesigned patient home.
- Improved routines.
- Family memory experience.
- Accessible family calling.

## Phase 3: Voice-First Companion
- Conversational mode.
- Task-focused mode.
- Permission-checked actions.
- Regional language support.
- Offline deterministic voice commands.
- Non-AI fallback.

## Phase 4: Caregiver and Clinician
- Unified caregiver daily dashboard.
- Family participation.
- Clinical authorization.
- Better reports and timelines.
- Improved patient history.

## Phase 5: Regional and Offline Maturity
- Eight-state localization coverage.
- Native-speaker validation.
- Regional cultural packs.
- Tested offline language assets.
- Robust synchronization.
- Low-end device optimization.

## Phase 6: Production Readiness
- Security testing.
- Accessibility testing.
- Real patient and caregiver usability testing.
- Backup restoration.
- Monitoring.
- Deployment and operational documentation.

No production deployment, database migration or destructive data modification should occur without explicit authorization.

---

# 20. Development Rules for AI Agents and Engineers

Any agent working on Smriti must follow these rules:

1. Read this specification and the existing architecture guide before making changes.
2. Inspect the actual repository before assuming a feature exists.
3. Distinguish implemented, partially implemented, proposed and unimplemented functionality.
4. Never invent successful test results.
5. Never silently remove existing functionality.
6. Never delete patient data.
7. Never run destructive database migrations without authorization.
8. Preserve patient privacy and access boundaries.
9. Never hardcode credentials or production secrets.
10. Test patient, caregiver and clinician roles separately.
11. Test offline behavior explicitly.
12. Test real devices and accessibility behavior.
13. Preserve the patient's existing data during upgrades.
14. Make incremental changes with backups and measurable results.
15. Stop and request authorization when a change exceeds its approved scope.

---

# 21. Open Technical Decisions

These items require technical validation before final implementation:

- Exact language list and dialect coverage for each NER state.
- Availability and licensing of regional offline speech-recognition models.
- Availability and quality of regional text-to-speech.
- AI provider selection and privacy requirements.
- Local encryption key recovery.
- Patient account recovery model.
- Multi-device synchronization conflict rules.
- Hosting and storage provider selection.
- Notification delivery guarantees.
- Applicable consent, privacy and data-retention requirements.

The approved product direction must be preserved while resolving these technical details.

---

# 22. Definition of Success

Smriti succeeds when:

- A patient can use it without needing to understand technology.
- A patient can interact through familiar voice commands.
- A patient can access personal memories and family connections.
- Daily routines remain usable without internet.
- Caregivers can coordinate care without navigating a fragmented system.
- Clinicians can access authorized, clearly attributed information.
- Regional users can interact in languages they actually understand.
- Sensitive information remains protected.
- AI failures do not break essential functionality.
- Families can use the essential product without subscription fees.

**The central product principle:**

Smriti should make technology feel less like technology.

For the patient, it should feel like a familiar companion.

For the caregiver, it should feel like a reliable care coordination system.

For the clinician, it should provide organized and trustworthy information.

All three experiences should work together through one secure, accessible and offline-first platform.

---

**End of Specification — SMRITI v1.0**
