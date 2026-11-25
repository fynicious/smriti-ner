# SMRITI (`Smriti-NER`) — 8-State NER Language, Script & Voice Validation Matrix

**Version:** 1.0  
**Last Updated:** 2026-11-25  
**Validation Principle:** Never fabricate translations, never silently substitute unrelated languages, and never mark a language pack verified without native-speaker review (`SMRITI_PHASE0_DECISION_RECORD.md`).

---

## 1. Eight-State Language & Script Coverage (`src/lib/i18n/metadata.ts`, `src/lib/translations.ts`)

| Code | Language / Variety | Primary State(s) | Script | Verification Status | Browser Web Speech STT / TTS | Offline ASR / Voice Strategy |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `en` | English | All NER States (Shared Fallback) | Latin | `VERIFIED_BASELINE` | Supported (online Web Speech) | Visual baseline (`247`+ keys); Caregiver voice recordings |
| `as` | Assamese (`অসমীয়া`) | **Assam** | Assamese-Bengali | `NEEDS_NATIVE_REVIEW` | Declared `as-IN` (device dependent) | Text pack ~212 keys; relies on Caregiver/native-recorded phrase clips offline |
| `brx` | Bodo (`बड़ो`) | Assam | Devanagari | `NEEDS_NATIVE_REVIEW` | Not reliably available | Text pack ~213 keys; Caregiver/native-recorded phrase clips offline |
| `kha` | Khasi | **Meghalaya** | Latin | `NEEDS_NATIVE_REVIEW` | Unsupported | Partial text (~170 distinct keys + EN fallback); requires native completion |
| `grt` | Garo (`A·chik`) | Meghalaya | Latin | `UNTRANSLATED_PLACEHOLDER` | Unsupported | **Pending community translation**; displays English baseline transparently |
| `mni` | Meitei (`মৈতৈলোন্`) | **Manipur** | Bengali Script | `NEEDS_NATIVE_REVIEW` | Declared `mni-IN` | Switchable via Caregiver Settings (`scriptPreference: 'bengali'`). ~215 distinct keys |
| `mni-mymk` | Meitei (`ꯃꯤꯇꯩ ꯂꯣꯟ`) | **Manipur** | **Meetei Mayek** | `PARTIAL_STARTER` | Unsupported | Switchable via Caregiver Settings (`scriptPreference: 'meetei_mayek'`); Noto Sans Meetei Mayek webfont stack; awaiting native review |
| `njm` | Angami (`Tenyidie`) | **Nagaland** | Latin | `UNTRANSLATED_PLACEHOLDER` | Unsupported | Nagaland primary language selection awaits community consultation |
| `njo` | Ao | **Nagaland** | Latin | `UNTRANSLATED_PLACEHOLDER` | Unsupported | Community translation & Nagaland language consultation pending |
| `lus` | Mizo (`Mizo ṭawng`) | **Mizoram** | Latin | `NEEDS_NATIVE_REVIEW` | Unsupported | Text draft ~237 keys; awaits native-speaker medical & UI validation |
| `njz` | Nyishi | **Arunachal Pradesh** | Latin | `PARTIAL_STARTER` | Unsupported | Starter greeting/nav phrases (`22` keys) + EN fallback; native translation needed |
| `adi` | Adi | Arunachal Pradesh | Latin | `PARTIAL_STARTER` | Unsupported | Starter (`22` keys) + EN fallback |
| `clk` | Mishmi | Arunachal Pradesh | Latin | `PARTIAL_STARTER` | Unsupported | Starter (`22` keys) + EN fallback |
| `trp` | Kokborok | **Tripura** | Latin | `PARTIAL_STARTER` | Unsupported | Starter (`22` keys) + EN fallback; native expansion required |
| `bn` | Bengali (`বাংলা`) | Tripura / Barak Valley | Bengali | `NEEDS_NATIVE_REVIEW` | Declared `bn-IN` | ~214 distinct keys; pending native clinical review |
| `ne` | Nepali (`नेपाली`) | **Sikkim** | Devanagari | `NEEDS_NATIVE_REVIEW` | Declared `ne-NP` | ~214 distinct keys; pending native clinical review |
| `sip` | Sikkimese (`འབྲས་ལྗོངས`) | Sikkim | Tibetan | `PARTIAL_STARTER` | Unsupported | Starter (`22` keys) + EN fallback |

---

## 2. Cultural Content Packs (`NER_REGIONAL_PACKS` — `src/lib/regional-content.ts`)

All 8 states are selectable under Caregiver Settings and paired with bundled offline SVG assets (`public/assets/ner/*` — zero broken external CDN images):
- **Assam (`ner-as-01`):** Assam tea, bamboo, spices, rice, lantern, basket, one-horned rhino, handloom.
- **Meghalaya (`ner-ml-01`):** Living root bridge (`root-bridge.svg`), bamboo, spices, basket.
- **Manipur (`ner-mn-01`):** Loktak floating `phumdi.svg`, traditional shawl (`shawl.svg`), rice, handloom.
- **Nagaland (`ner-nl-01`):** Hornbill (`hornbill.svg`), tribal shawl (`shawl.svg`), bamboo, spices.
- **Mizoram (`ner-mz-01`):** Bamboo Cheraw (`cheraw.svg`), basket, lantern, morning mountain light.
- **Arunachal Pradesh (`ner-ar-01`):** River valley, bamboo, monastery (`monastery.svg`), pine hillside.
- **Tripura (`ner-tr-01`):** Queen pineapple (`pineapple.svg`), handloom, bamboo, rice.
- **Sikkim (`ner-sk-01`):** Monastery (`monastery.svg`), tea gardens, spices, lantern.

---

## 3. Offline Voice, Capability Disclosure & Locale Formatting

- **Transparent UI Badges (`SpeakButton.tsx` & `ConversationalUI.tsx`):** Every patient and portal screen reads `capabilities` (`getLanguageCapabilities(effectiveLang)`), visibly disclosing when native-speaker review is pending or when offline STT/TTS is unavailable on the active language.
- **Offline Phrase Recording Hierarchy (`src/lib/offline-voice.ts` & `/caregiver/voice`):** `playRecordedPhraseOrFallback()` first checks IndexedDB `db.voiceReminders` for caregiver/native-speaker recorded clips (`phrase:drink_water`, `phrase:take_medicine`, `phrase:good_morning`, `phrase:call_family`, `phrase:open_games`) before falling back to browser `SpeechSynthesis` (only when supported) or visual-only mode.
- **Locale Date/Number Formatting (`src/lib/locale-format.ts`):** Safe `Intl.DateTimeFormat` / `Intl.NumberFormat` wrappers supporting Indian NER BCP-47 tags with fallback to `'en-IN'`.
- **Researched Future Server Voice Path (`bhashini.gov.in`):** MeitY BHASHINI Conformer/VITS pipelines support Assamese, Bodo, Manipuri, Bengali, and Nepali when online (requiring government API registration); it does not operate offline or cover non-scheduled languages (`Khasi`, `Mizo`, `Nyishi`, `Kokborok`, Naga varieties), confirming the necessity of offline caregiver-recorded audio + large visual UI parity.
