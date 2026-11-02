# GTAI: Uprising - Steam release standard (Steamworks, store, review, Deck)

Research date and access date for every URL below: **2026-11-02**. Scope: the partner, store and release side only. In-game Steamworks API work (achievements, cloud, Steam Input glyph calls, overlay) is another agent's topic; this file only states what the *store and review* require of it.

## 0. How to read this file

- **[V Sn]** = verified: I fetched that primary page on 2026-11-02 and the sentence or number is on it. Sources are listed in section 16.
- **[V2 Sn]** = read in a secondary source (press, law firm, forum); treat as likely, re-check before relying on it.
- **[I]** = inference or general knowledge, not found on a page I could read. Do not build a gate on an [I] without checking.
- **Pages I could not read:** everything behind the Steamworks login (the content survey questionnaire itself, the Basic Info form fields, the store-page ratings form, the live "Deck compatibility results" UI, depot UI, the Steam Distribution Agreement text, per-app checklists). Public docs under partner.steamgames.com/doc/ were readable without login and are the main source. Steam's own help-site content-preference pages could not be fetched (search returned only forum threads).
- Three of my own source fetches failed and are not used as evidence: videogameschronicle.com (HTTP 403), classification.gov.au rating pages (timeout), Valve's own January 2026 AI-policy post (not found; only secondary coverage).
- Rule words: **MUST** = Steam blocks or rejects without it, or it is legally required. **SHOULD** = strongly advised by Valve or by risk for this game.

## 1. The twelve rules that matter most

1. MUST finish onboarding (identity, bank, tax) and pay the $100 app fee **at least 21 days before the release date**; plan for tax verification to take up to 30 days. (R1-R4)
2. MUST have a public Coming Soon page live for **at least 2 weeks** before release. (R6)
3. MUST NOT put the final game name in the store before you are sure of it: the name is locked once the store page has passed review. (R7)
4. MUST supply every required graphic at its exact size; capsules are limited to art + title and must be **PG-13 appropriate**. (section 3)
5. MUST complete the Content Survey honestly (General, Mature, Generative AI) before submitting for review; this game MUST declare frequent violence/gore and general mature content, and pre-generated AI art, audio and narrative. (R20-R30)
6. MUST NOT tick "Adult Only Sexual Content" unless it is truly there (this game should not need it). (R22)
7. MUST submit the store page for review first, the build second, each at least 7 business days before you need it. (R40-R43)
8. MUST ship a build that launches on every OS you tick on the store page. Tick Windows only unless a native Linux build is real. (R50, R62)
9. SHOULD treat Steam Deck Verified as a build requirement, not a polish item: 1280x800, 9 px minimum text (aim 12 px), controller-only access to everything, on-screen keyboard for any text field, correct glyphs. (R70-R78)
10. MUST include the Godot MIT licence text and third-party notices in the game; GodotSteam is MIT. (R90-R92)
11. SHOULD NOT use the Steam DRM wrapper; do not encrypt the PCK. (R57, R58)
12. SHOULD get an IP lawyer's read on the title "GTAI" before the name locks. It is the single largest avoidable risk in this file. (section 14)

## 2. Onboarding and timing

| # | Rule | Evidence |
|---|---|---|
| R1 | MUST onboard as the legal entity that owns the game, or as a sole proprietor using your **legal first and last name**. No alias, no DBA, no friendly name. Name must match bank and tax records exactly. Do not use characters unique to a non-English language. | [V S1, S2] |
| R2 | MUST provide bank details; "the account holder name on your bank account must match the name you provide when onboarding." Individuals may onboard, but the bank account must carry the same name. | [V S1] |
| R3 | MUST complete the tax interview (W-9 for US; W-8BEN for treaty countries). It is conducted by a third party (TaxIdentity/Lilaham), takes 5-10 minutes, cannot be saved partway, and must be done under the same name as Company Information. Games cannot be released before valid bank and tax info exists. | [V S1, S2] |
| R4 | MUST budget tax verification time. Two Valve pages disagree: onboarding says "up to 30 days", the FAQ says "2-7 business days" and a newly issued TIN "can take up to 30 days". Plan for the long end. You cannot edit tax info until verification finishes. | [V S1, S2] |
| R5 | MUST pay the **$100 USD per app** Steam Direct fee (any Steam-supported payment method, not Steam Wallet funds, by a Steamworks admin). Non-refundable; recouped from payments after the app earns **$1,000 adjusted gross revenue**. The invoice goes to the Steam account that paid. | [V S1, S3] |
| R6 | MUST respect two timing gates: a **21-day waiting period between paying the app fee and releasing**, and a Coming Soon page public for **at least two weeks**. Note: the brief said "30-day waiting periods"; the current page says 21 days. The 30-day figure on that page is the tax-verification ceiling. | [V S1, S4] |
| R7 | MUST pick the final name before the first store-page review. "Your game's name cannot be changed once a game has been through pre-release review" unless you have unlocked profile features; you then must ask Valve and justify (legal reasons are an accepted question). Localized names have the same limit. | [V S5, S6] |
| R8 | MUST complete the electronic Non-Disclosure Agreement and Steam Distribution Agreement. The SDA text itself is login-gated; I did not read it. Revenue share and other commercial terms are therefore not verified here. | [V S1] [I] for terms |
| R9 | SHOULD create a dedicated **build account** (Steam account with only "Edit App Metadata" and "Publish App Changes To Steam"). Setting a build live for a *released* app requires a phone number or the Steam Mobile app on that account, and a 3-day wait after any security change on the account. | [V S7] |
| R10 | MUST NOT have sanctioned-party exposure: Valve does not do business with OFAC-listed parties or in Crimea, Cuba, Iran, North Korea. | [V S2] |

Identity checks: Valve may ask for a selfie holding your ID (full face, ID legible, four corners visible, JPEG). Prepare it before you start. [V S8]

## 3. Store graphical assets (table)

Rules that apply to all capsules [V S9] (the "PG-13" rule is quoted from the same page): only game artwork, the game name and an official subtitle. No review scores, award names/logos, discount copy, call-to-action copy ("Wishlist now", "Prepurchase"), promo of other products (including sequels), or other text. Capsules must contain a readable product logo or name and have the exact dimensions. **All capsule images (store and library) must have PG-13 appropriate artwork.** Games that break these rules "may have limits to visibility within the Steam store and will be ineligible for featuring in official Steam sales and events." [V S9] Since August 2024 only the larger sizes below are accepted; "old dimensions are no longer accepted." [V S10]

| Asset | Req? | Size (px) | Format | Content rules and notes | Src |
|---|---|---|---|---|---|
| Header Capsule | Required | 920 x 430 | not stated (use PNG or JPG) [I] | Top of store page, Recommended For You, Big Picture. Logo legible. Smaller versions are generated. | V S10, S11 |
| Small Capsule | Required | 462 x 174 | not stated | Lists, search, top sellers. Logo should nearly fill it; art may differ from other capsules. 120x45 and 184x69 are generated. | V S11 |
| Main Capsule | Required | 1232 x 706 | not stated | Store home carousel. Key art + logo, no extra text. | V S11 |
| Vertical Capsule | Required | 748 x 896 | not stated | Seasonal sales and sale pages. | V S11 |
| Screenshots | Required, **minimum 5** | 1920 x 1080 minimum, 16:9 | not stated (PNG/JPG) [I] | Gameplay only: no concept art, pre-rendered stills, awards, marketing copy. Menus only if unique. **Mark at least 4 as "suitable for all ages"** (no gore, violence, suggestive themes) or the game may not show in some places, such as the front-page hover. Localized screenshot: drag onto thumbnail, name suffix e.g. `_german`. | V S11 |
| Page Background | Optional | 1438 x 810 | not stated | Ambient, not bright. If absent Steam builds one from the last screenshot. | V S11 |
| Bundle Header | Only if bundle | 707 x 232 | not stated | Branding focus. | V S11 |
| Library Capsule | Required | 600 x 900 | not stated (half-size 300x450 PNG auto-made) | Must include game logo; subtitle allowed; no other text. | V S12, S10 |
| Library Header | Required | 920 x 430 | not stated | Falls back to Header Capsule if not set. | V S12 |
| Library Hero | Required | 3840 x 1240 | **PNG** (half-size 1920x620 auto-made) | **No text at all.** Safe area 860 x 380 in the center. Without hero+logo Steam shows a screenshot with the name overlaid. | V S12 |
| Library Logo | Required | **1280 wide and/or 720 tall** | **PNG, transparent** | Only the logotype (optional logomark), no other words. Pick position after upload (bottom-left, top/middle/bottom center). | V S12 |
| Shortcut Icon | Required | 256 x 256 or 512 x 512 | ICO or PNG | Steam generates the ICO from a PNG. A Mac `.icns` only if you ship macOS. | V S13 |
| App (client) Icon | Required | 184 x 184 | **JPG** | Library list view, chat favorites, notifications, Deck. Does not render on the store page until the app is Coming Soon or released. Alpha from the Shortcut Icon becomes solid black if used to derive it. | V S13 |
| Community icon | see App Icon | 184 x 184 JPG | JPG | The community/client icon is the App Icon above; the docs list no separate size. | V S13 [I] mapping |
| Event Cover | Required for events | 800 x 450 | not stated | Announcements and events; Steam adds name and icon next to it. | V S14 |
| Event Header | Suggested | 1920 x 622 | not stated | Template has clipping rules. | V S14 |
| Artwork Override | Optional | same as capsule | - | Only way to put update text on a capsule: max one month, text must be localized into at least the game's supported languages, only for currently available content. | V S10 |
| Trailer (video) | **Required** (at least one) | up to 1920 x 1080, 16:9 preferred (4:3 accepted) | .mp4/.mov/.wmv; H.264 + AAC preferred | 30/29.97 or 60/59.94 fps, 5,000+ kbps (Valve's Media Encoder preset: H.264 20 Mbps, AAC stereo 192 kbps), audio sample rate 44 or 48 kHz, audio is down-mixed to stereo. First two valid trailers show before screenshots. | V S15 |
| Trailer poster/thumbnail | Auto | 600 x 380 poster, 232 x 130 thumbnail | - | Custom thumbnail: a frame from the video, 1920x1080 PNG/JPG, no text. | V S15 |
| Microtrailer | Auto | 6 s loop | - | Built from the first visible video (six 1-second clips). Not customizable. | V S15 |
| Description images/GIFs | Optional | 1170 px wide recommended (up to 4096 wide gets full-screen view) | PNG, JPG, GIF, WEBP, MP4, WEBM | Animations only in About This Game; animated max 12 s; each image under 5 MB; all screenshots + GIFs total under 15 MB; set BT.709 colour space; add alt text. | V S16, S17 |

Trailer rules of use [V S15]: put a gameplay trailer first and show HUD; categorize each (General/Cinematic, Teaser, Gameplay, Interview). A game **cannot be released while a trailer is still converting**. Country-restricted trailer versions exist: "If you have PEGI and ESRB rated videos that should only appear in certain countries, you can restrict the visibility of your trailer to certain countries" by ISO codes. This is the lever for a gore-trimmed trailer for Germany.

Implications for this game:
- R11 MUST composite the logo onto capsules in code or a layout tool; do not rely on an image model to render the title text. [I]
- R12 MUST use a gore-free, profanity-free, PG-13 key-art crop for every capsule and the library hero, even though the game is M-rated; the violence goes in screenshots and trailer. [V S10 for the rule] [I for approach]
- R13 SHOULD choose the all-ages screenshots deliberately (menus with art, a driving shot, a robot idle pose) and keep a list; do not hope the default passes. [V S11]
- R14 SHOULD keep the Trivet riso art at screenshot size 1920x1080 and generate captures by script from the build so they are provably gameplay (see R30 for AI disclosure effects). [I]

## 4. Store text, tags, languages, requirements, controller declaration

| # | Rule | Evidence |
|---|---|---|
| R15 | MUST write a Short Description (plain text, "a few hundred characters", no formatting, no time-based text such as "Now Available") and an About This Game section. Descriptions must be "detailed and coherent". | [V S18, S19] |
| R16 | MUST NOT put any link, QR code, or implied URL ("DOTA2 DOT COM") in descriptions or graphics; use the Basic Info link fields. MUST NOT use images that mimic Steam UI. MUST NOT reference or advertise other products on Steam. **Practical effect: do not market this as "GTA 2 but..." in the Steam description or images.** Describe the game on its own terms. | [V S18] [I] for the GTA effect |
| R17 | MUST describe only features that exist in the launch build; remove planned features or label them clearly not yet released. | [V S19] |
| R18 | MUST apply **at least 5 tags** before launch; set up to 20 (only the top 20 are shown and used). Top 5 are the identity; the first 15 matter for some filters. Remove wrong tags (e.g. "Family Friendly"). Candidate set to evaluate in the Tag Wizard (names to confirm there): Top-Down, Action, Crime, Violent, Gore, Dark Humor, Satire, Sci-Fi, Robots, Open World, Singleplayer, Story Rich, avoid Pixel Graphics because the art is riso/cutout; prefer Stylized and Hand-drawn if the wizard offers them. | [V S20] candidate list is [I] |
| R19 | SHOULD fill the Accessibility Feature Wizard honestly (adjustable difficulty, save anytime, volume controls, adjustable text size, subtitle options, colour alternatives, contrast, camera comfort, and others). It is displayed on the store page and searchable. Only tick what the build does. | [V S21] |

**Languages.** Steam fully supports 29 languages. In-game support is declared per language as Interface, Full Audio, and Subtitles; store-page translation is independent. Language support "is determined by the in-game language settings, not the store page", Steam "favors products that are localized", and Valve advises releasing more languages later as an update announced with the Update Visibility Round tool. Missing languages are not a block. [V S22, S23]

Proposed launch matrix for this game (an owner decision, see open questions) [I]:

| Language | Interface | Full audio | Subtitles |
|---|---|---|---|
| English | yes | yes (if voice lines ship; see `games/gtai/voices/`) | yes |
| All others at 1.0 | no | no | no |
| Post-launch candidates | add as update: German, French, Spanish, Portuguese-Brazil, Russian, Simplified Chinese, Japanese, Korean | no | yes |

Do not tick a language that is machine-translated and unreviewed for a profane satire; slang and swearing machine-translate badly, and the text counts as AI-generated shipped content (R29). [I]

**System requirements.** The Basic Info tab takes minimum and recommended requirements per OS (login-gated; fields not read). Derive them from measured data, not guesses. The city-scale spike (`games/gtai/research/godot-city-scale.md`) measured about 51 fps average, 26 fps 1 percent low at 201 actors on GDScript, so state a conservative minimum and test on a low-end Windows PC and on a Deck. [I]

**Controller support declaration.** The Basic Info tab has a "Controller Support" declaration describing supported devices (Full / Partial / None; exact labels not readable here). Declare **Full** only if the entire game, including menus and text entry, is playable by controller. The build review checks that every feature ticked on the store page is implemented. [V S19, S24] labels [I]

## 5. The content survey, mature content and visibility

What Valve states [V S25]:
- Three sections, all required before the first review submission: General Content, Mature Content, Generative AI.
- General Content "will generate ratings for several regional rating boards that will be displayed on your storepage once the game releases."
- Mature Content: answers "determine how your game appears relative to each customer's preferences", and "you must disclose all the adult content you've uploaded in your builds, even if it's not accessible or presented in your product." Be exact: undisclosed content is a policy breach, and Valve compares answers to build and store page.
- After approval "some questions in the survey cannot be edited without first contacting Steam Support" (give a summary, the affected result, and tester access instructions). Get it right before review.
- "Products on Steam must adhere to the content rules, regardless of whether it is disclosed."

Observed live on the public store (2026-11-02, via `store.steampowered.com/api/appdetails` and the Hotline Miami store page) [V S26]:
- Content descriptor labels shown to shoppers include **"Frequent Violence or Gore"** and **"General Mature Content"** (Hotline Miami: descriptors ids 2 and 5; Postal 2: 1, 2, 5; GTA V Legacy: 5 only).
- Steam itself generates regional ratings for Germany (`steam_germany`), Brazil (`dejus`) and Indonesia (`igrs`) from the survey. Hotline Miami (a close behavioural comparable: brutal, profane, top-down): Steam Germany 18, Brazil 18, Indonesia 18, plus ESRB M, PEGI 16, USK 16 entered by the publisher. Postal 2: Steam Germany 18, Brazil 18, **Indonesia BANNED**.
- The age-gate warning appears when a game's content descriptors conflict with the viewer's preference settings, "including defaults." There is also an optional age-gate checkbox when you enter ESRB or PEGI style ratings. [V S27]

| # | Rule | Evidence |
|---|---|---|
| R20 | MUST answer General Content so Steam can generate the Germany, Brazil and Indonesia ratings. Without a completed survey Valve cannot rate the game, and **games without a German rating are not shown to German customers** (rule effective 2024-11-15). Customers who already own it are unaffected. | [V S28, S29] |
| R21 | MUST expect "Frequent Violence or Gore" and "General Mature Content" for this game. Do not try to avoid them: under-declaring is the failure mode, not the label. The label puts the game behind some customers' content filters; that is the cost of the genre and Hotline Miami ships with it. | [V S26] [I] for conclusion |
| R22 | MUST NOT tick "Adult Only Sexual Content" unless the build contains it. That tier is hidden by default per community reports, requires both the page and the build to be reviewed, and can take longer than the usual 3-5 business days. The satire's sexual content should stay below that bar. | [V S19 for review delay] [V2 S30 for default-hidden] |
| R23 | SHOULD fill in a content note in plain words ("graphic robot and human violence, strong profanity, drug references") in the mature description field so the store explains it. | [I] |
| R24 | MUST NOT assume filter defaults for "Frequent Violence or Gore". I could not verify which categories are hidden by default; community threads indicate only the adult-only tier is off by default. Test with a logged-out and a default-settings account before launch. | [I] |
| R25 | MUST keep an internal **content disclosure sheet** (all violence types, gore, profanity words list, drug references, sexual references, nudity, gambling, real-world groups depicted) updated per build; use it to answer the survey and to answer Valve if review asks. | [I] |

Valve's hard line in the onboarding rules (content Valve lists as "What you shouldn't publish") [V S1]: hate speech (promotes hatred, violence or discrimination against groups based on ethnicity, religion, gender, age, disability or sexual orientation); adult content that isn't labeled and age-gated; libelous or defamatory statements; content you do not own or have rights to; content that violates the law of any jurisdiction where it is sold; and "content that is patently offensive or intended to shock or disgust viewers." "Politically incorrect" is therefore the area to manage: aim the satire at institutions, corporations, the military and the genre, not at protected groups, and keep the shock tied to a comic or narrative point. See section 14.

## 6. Generative AI content disclosure

Valve's current survey text [V S25]: the third section "is concerned with the use of AI in creating content that ships with your game, and is consumed by players. This includes content such as artwork, sound, narrative, localization, etc." Efficiency gains from AI-powered tools built into development software are "not the focus."
- **Pre-generated** = "content that ships with your game and is consumed by players that is created with the help of AI tools during development." Valve says under the Steam Distribution Agreement you promise the game has no illegal or infringing content and is consistent with your marketing; "in our prerelease review, we will evaluate the output of AI generated content in your game the same way we evaluate all non-AI content."
- **Live-generated** = content created by AI while the game runs. Extra duty: describe guardrails against illegal content; live adult-only sexual content is not shipped at all; ongoing per-use AI costs must be handled by you and billed via Steam (price, microtransactions, subscription, or DLC).
- Valve said in January 2024 it "will also include much of your disclosure on the Steam store page", and added an overlay report button for illegal content in live-AI games. [V2 S31]
- The 2026 rewrite (reported dates 16-17 January 2026, no Valve announcement found) refocused the policy on player-facing content and exempted development tools such as code assistants, with disclosure shown under About This Game. Treat the date and the exemption list as [V2 S32, S33]; the survey wording above is the verified part.

| # | Rule | Evidence |
|---|---|---|
| R26 | MUST declare **pre-generated AI** for this game: Nano Banana (Gemini image) character parts and OpenAI image-model art (via Codex CLI) that appear in the shipped build. Name the tools, the content categories (sprites, key art, UI, promo), and the process (AI parts, human-curated, rigged and finished in code). | [V S25] [I] for specifics |
| R27 | MUST also declare AI used for **audio** (any TTS or generated voice in `games/gtai/voices/`) and **narrative/dialogue** (LLM-written quest and line text, even if human-edited) if they ship. When unsure, disclose: Valve gives no percentage threshold for human editing. | [V S25] [V2 S33] |
| R28 | MUST state "no live-generated AI" if that is true, and keep it true: a runtime LLM call (for example, dynamic voices or quests) would trigger guardrails, cost-handling and player-report obligations. | [V S25] |
| R29 | SHOULD disclose AI used for marketing assets (capsules, key art, trailer shots) and AI translation. Secondary sources say store-page art, descriptions and localization fall under the disclosure. | [V2 S32, S33] |
| R30 | MUST keep a **provenance log** per AI asset: model, date, prompt, source references, human edits, and the final file hash, under `games/gtai/steam/ai-provenance/`. Valve rejected a 2023 submission over unclear training-data rights before the current policy and has used training-data provenance as a ground for rejection; the log is your evidence that you checked. | [V2 S34 for the 2023 rejection] [I] |
| R31 | MUST NOT prompt image or text models with real franchise names, real artists' names, or GTA-specific key art ("in the style of GTA 2 cover"). The output is judged for infringement. | [V S25 for the standard] [I] |
| R32 | SHOULD edit the disclosure text as if a player will read it, because Valve may publish it. | [V2 S31] |
| R33 | MUST re-open the survey and contact Steam Support if a patch adds AI content or changes a locked answer after approval. | [V S25] [I] for "patch" application |

Copyright note [I]: purely AI-generated art may not be copyrightable in the US (US Copyright Office position: human authorship required; see S35), so heavy AI art may be unprotectable against copying. The human-authored layer (rig, composition, procedural motion, writing) is what you can claim. This is a business risk, not a Steam rule.

## 7. Age ratings and legal exposure

**IARC.** Steam does not use IARC. Evidence: Valve's Germany page says a game can carry a USK rating or one "issued by Valve through its own self-rating process"; "you must not submit a USK rating on Steam if it has been generated through the IARC process on a third-party store"; live store data shows Steam-generated ratings (`steam_germany`, `igrs`, `dejus`). [V S28, S26] So an IARC certificate from another store is of no use on Steam and the USK number from it must not be entered. [I] that no other Steam IARC flow exists.

| # | Rule | Evidence |
|---|---|---|
| R34 | MUST NOT pay for ESRB, PEGI or USK just to list on Steam. They are optional ("if you already have ratings issued... you may enter those"). Needed only for consoles or physical. Enter a real board rating only if it was issued on the exact build shipped. | [V S25, S28] |
| R35 | SHOULD still expect: ESRB M (Hotline Miami got M with Blood and Gore, Crude Humor, Drug Reference, Intense Violence, Strong Language), PEGI 16-18, USK 16-18, Steam Germany 18, Brazil 18. Do not market it as suitable for under-17s. | [V S26] [I] extrapolation |
| R36 | MUST check the Indonesian risk: Indonesia requires a rating (IGRS 3+/7+/13+/15+/18+/Refused) and Steam's page warns "in the near future" it may stop displaying unrated games. Postal 2 shows "BANNED" there. A ban hides the game in that country only; it is not a blocker for release. | [V S36, S26] |
| R37 | MUST check Australia. The Classification Board's position, as reported when Schedule I was pulled from Steam AU in May 2025, is that computer games sold through online storefronts must be classified. R 18+ allows violence, but "high impact violence that is, in context, frequently gratuitous, exploitative and offensive to a reasonable adult will not be permitted", and RC (refused) covers violence "with a very high degree of impact which are excessively frequent, prolonged, detailed or repetitive" and "cruelty or realistic violence which are very detailed and which have a very high impact". The 2023 guidelines also refuse **"illicit or proscribed drug use related to incentives or rewards"** and interactive realistic drug use, and "detailed instruction or promotion in matters of crime or violence". Guidelines took effect 2024-09-22. | [V S37 guideline text] [V2 S38 for the Steam AU removal] |
| R38 | MUST NOT reward drug use mechanically (no "pills give +damage" loop with real drug names) if you want Australia. Use fictional chemicals and avoid positive reinforcement framing. | [V S37] [I] for application |
| R39 | SHOULD treat Germany as the strictest mainstream market: Steam shows "no valid rating = hidden"; "there are certain kinds of content that are not allowed for sale to customers in Germany... must be disclosed". Extreme violence glorification can lead to a refusal. Robots as victims, oil instead of blood and non-realistic stylization are mitigations [I]. Keep a Germany-safe option: a settings toggle that reduces gore and a country-restricted trailer. | [V S28] [I] for mitigations |

## 8. Review processes, release checklist, Next Fest, wishlist

| # | Rule | Evidence |
|---|---|---|
| R40 | MUST complete both release checklists (Store Presence, then Game Build) and click "Mark as ready for review". **Store presence is submitted first; the build can only be submitted after.** Valve reviews both once; afterwards you can update freely ("review once; update any time"). | [V S4, S19, S39] |
| R41 | MUST allow time. Store presence review takes 3-5 business days; submit at least **7 business days** before you want the page live (the Coming Soon doc says "at least 7 business days"; one release page says "7 days"). Build review is also 3-5 business days; plan 7. The onboarding page says 1-5 days. | [V S19, S39, S40] |
| R42 | MUST remember what reviewers check. Store page: only launch-available features; readable title on capsules; screenshots are gameplay only; coherent detailed description with no external links. Build: starts correctly on **every OS you listed**; every feature ticked on the store page is implemented; any in-game transaction uses Steam Wallet. They run the build and compare to your survey and store page. The build should be "near-final", on the **default branch**. | [V S19, S25, S39] |
| R43 | MUST hold both permissions "Publish app changes to Steam" and "Manage pricing and discounts" on the releasing account or the release fails. | [V S39] |
| R44 | MUST press "Release App" yourself; approved titles never auto-release. Release also publishes the package and sets the launch discount live. Weekend release is possible but the date picker hides weekends because the Steam Team is unavailable. Release date can be changed until **two weeks before**; after that it stops being adjustable. Pick a weekday. | [V S39, S41] |
| R45 | SHOULD set the release-date display (exact date / month / quarter / year / "Coming Soon"). An exact internal date is mandatory, and sorting uses the last possible day of the displayed range. | [V S41] |
| R46 | MUST NOT publish a Coming Soon page by accident: "publishing a store page will move ALL store page data and assets... to Steam's public servers" where they can be scraped even if hidden. Use Store Beta Mode "Preview changes in store" first. | [V S42] |
| R47 | SHOULD publish Coming Soon as soon as art direction and core feature set are stable; Valve says there is no strong downside to a long Coming Soon period and a wishlist from two years out converts about as well as one from two weeks out. | [V S43] |

**Steam Next Fest** (unreleased games only, one Next Fest per title, once ever) [V S44]:
- Must have the base store page public, a publicly playable demo by the start, not release before the Fest ends, not be a prologue or short form of an already released game.
- Registration is from the base game. Demo is a separate App ID attached to the base game ("Add Demo"). Submit the demo build for review at least 3 weeks before the Fest (5 weeks if you want it live for Press Preview).
- Next editions with dates published on Valve pages: **February 22 to March 1, 2027** (registration deadline January 10, 2027; demo/store page by January 18 for Press Preview; all required items by February 1); **June 14 to 21, 2027**. [V S45, S46]
- Decision: a one-shot. Use it when the demo is the best 30 minutes of the game (about 3 months before launch is typical) [I].

**Wishlist and visibility basics** [V S43, S47, S48]: wishlist adds start once the page is public; release sends an email/push to wishlisters; a discount of 20 percent or more on the lowest-priced package for over 8 hours triggers wishlist emails; notifications have a two-week cooldown per customer. Wishlists are "mostly" not an algorithmic visibility factor (exception: Popular Upcoming); players and purchases, language support and tags are. Baseline visibility at launch is the New Releases queue that prioritizes the least-viewed new titles, and a user's tag filters can exclude you from it (so "Gore/Violent" tags cut audience; accept it).

## 9. Builds and depots (SteamPipe)

| # | Rule | Evidence |
|---|---|---|
| R50 | MUST set at least one launch option (executable path relative to install root, optional arguments, per OS) under General Installation Settings, and at least one depot, then publish the app config before building. | [V S7] |
| R51 | MUST use a depot per OS if you ship natively on both: Windows files in a Windows-only depot, Linux files in a Linux-only depot, common data in a depot for both or all OSes. Language-specific depots only if the localized payload is large; otherwise use one depot and `GetCurrentGameLanguage`. If an OS is ticked on the store page and a package lacks an OS depot, the landing page warns and those players cannot download. | [V S49, S22] |
| R52 | MUST build with `steamcmd +login <builder> +run_app_build ..\scripts\app_build_<APPID>.vdf +quit` from the SDK `tools\ContentBuilder` folder (`builder`, `content`, `output`, `scripts`). Keep `output` on a separate disk if you can. Use `"Preview" "1"` to dry-run mappings and `FileExclusion` for `*.pdb`, debug and dev files. Build logs are in the output folder, not the console. | [V S7] |
| R53 | MUST understand patching: files are split into roughly **1 MB chunks**, compressed and encrypted; only changed chunks download. Large pack files, shuffled asset order, compression or encryption that crosses asset boundaries, and a table of contents with absolute offsets spread through the file all inflate patches. Valve recommends packs of about 1-2 GB maximum, grouped by level or feature, **new packs for new content** rather than modifying old ones, no timestamps or original filenames in packs. | [V S7] |
| R54 | SHOULD structure the Godot export for small patches [I, applying S7 guidance]: keep the engine executable and GDExtension binaries in their own depot (rarely changes); split game data into several PCKs (for example `core.pck`, one per act, `audio_*.pck`, `art_*.pck`) so a hotfix touches one pack; do not embed the PCK in the executable; keep PCK compression off or per-asset; no PCK encryption (see R58); deterministic export ordering and no build timestamps in assets. Verify with a binary diff between two builds before the first public update. | [I] applying S7 |
| R55 | MUST know branches: `default` is what customers get; you cannot set a build live on `default` via script (`SetLive` skips it), only in the Steamworks Builds page. Make beta branches (name has no spaces, optional password) for `internal`, `deck-test`, `hotfix` and let testers opt in via Properties > Game Versions & Betas. After release, test every update on a beta branch first. | [V S7, S50] |
| R56 | SHOULD use **Steam Playtest** (a linked AppID with no separate store page) or release-override keys for closed testing, not the live app. | [V S51] |
| R57 | **Steam DRM wrapper: decision NO.** Valve: "the Steam DRM wrapper by itself is not an anti-piracy solution... easily removed by a motivated attacker", and Valve does "not recommend" anti-tamper/DRM on Proton because it slows Deck support. It can be applied via `drm_wrap` in the build script or the App Admin page (flags 0, 6, 32, 38). It is optional; skip it, rely on the SteamAPI ownership check (other agent's topic). Test the unwrapped build on Deck. | [V S52, S53] decision [I] |
| R58 | MUST NOT encrypt the PCK or ship custom copy protection. A Godot forum report (Godot 4.6.2) shows an encrypted native Linux export that failed under the Steam Linux runtime and ran only under Proton at reduced performance. One developer's report. | [V2 S54] |
| R59 | SHOULD enable common redistributables only if needed: the Redistributables tab can install Visual C++, .NET, DirectX 9, OpenAL, XNA and PhysX once per machine. A Godot export plus GodotSteam usually needs none; verify on a clean Windows VM and tick Visual C++ only if the GDExtension DLL needs it. | [V S55] [I] for Godot specifics |
| R60 | MUST NOT ship development files in the depot: no `steam_appid.txt` (dev only), no `.pdb`, no editor files, no logs. | [I] |
| R61 | SHOULD ship **Windows first** and let Deck run it under Proton. Valve tests a native Linux build first when one exists, falls back to the Windows build under Proton if the Linux one fails, and **publishes whichever result is better**. Godot's own Steam Deck tutorial recommends building both and comparing. If you add native Linux, ticking Linux means the build review must start it there. | [V S56] [V2 S57] |
| R62 | MUST confirm the architecture: Steam supports Windows 7+ and 64-bit Linux builds are "highly recommended"; Linux support officially means Ubuntu and SteamOS. Only tick the OS rows you actually test. | [V S58] |
| R63 | MUST decide the renderer deliberately [I]: Godot 4.6+ makes **Direct3D 12 the default on Windows** for new projects (reported in Godot 4.6 coverage), and Valve recommends Vulkan on Deck, noting that Proton's DirectX-to-Vulkan layer often beats a custom path. Test both `--rendering-driver vulkan` and d3d12 under Proton on a real Deck and ship the better one as a launch argument. | [V S59] [V2 S60] |

## 10. Steam Deck (and Steam Machine) compatibility review

The review is run by Valve against a published checklist; results come as one rating each for Deck, Steam Machine and other SteamOS devices. Deck Verified implies Machine Verified. Badges: **Verified** (all checks pass, no user configuration), **Playable** (works but needs manual work: choosing a community controller config, opening the on-screen keyboard by hand, using the touchscreen in a launcher), **Unsupported** (does not function: Proton or hardware incompatibility), **Unknown** (not reviewed). The result does not affect availability, only presentation. Results are previewed for about a week and then auto-publish; you can fix and request a re-review before publication; you cannot delay publication for future work. A normal build review must be passed before requesting a compatibility review. The manual request link is not available to all partners; other routes are heuristic or Valve selection. [V S56]

Verified criteria, verbatim in substance [V S56]:

| Area | Criterion |
|---|---|
| Input: controls | Game must support Deck's physical controls (Steam Controller inputs for Machine). **The default controller configuration must provide access to all content**; players must not need to change any in-game setting to enable controller support. |
| Input: glyphs | On-screen glyphs must match the active input (Deck, Steam Controller or Xbox glyphs). Mouse and keyboard glyphs must not appear when using the controller. Strongly recommended: Steam Input API for correct glyphs. |
| Input: text | Any text entry (naming, save names) must open the on-screen keyboard through a Steamworks API, or have built-in controller-only entry that works in the player's language. |
| Performance | Default configuration must hit a playable frame rate: **30 fps at 800p on Deck, 30 fps at 1080p on Machine**. |
| Seamlessness | No "device unsupported" warnings about the Linux distribution or GPU. Launchers must meet the same rules and be fully controller-navigable (Valve recommends not requiring one at all). |
| Display (Deck only) | Must run at a supported resolution; native **1280x800 (16:10) preferred, 1280x720 acceptable**. |
| Text legibility (Deck only) | Interface text must be readable at 12 inches / 30 cm: **smallest character at least 9 px high at 1280x800**; Valve recommends 12 px, user-configurable text size, and contrast options. |
| Proton | Blocking Proton bugs, missing middleware (some anti-cheat, some media codecs) or unimplemented Windows functionality give **Unsupported** until fixed. |

Non-blocking recommendations [V S61]: Steam Cloud for saves but never graphics settings (keep resolution and quality per device); do not lock settings to detected hardware; support other aspect ratios; offline play for all single-player content (test first run on a new account offline); no .NET/WPF launchers; standalone codecs (VP9, AV1) not Windows Media Foundation; mixed mouse + controller input without glyph flipping; Vulkan as primary API. Valve also explicitly lists **Windows Media Foundation, .NET/WPF launchers, kernel anti-cheat and DRM** as known Proton delay risks. [V S53]

Suspend/resume is **not** a published Verified criterion on the pages I read. Test it anyway (suspend mid-fight, resume, with audio and with a controller reconnect), because a hang is a user-visible failure and review testers run the game on the device. [V S56 for absence] [I] for the advice.

| # | Rule for this game | Evidence |
|---|---|---|
| R70 | MUST run the game fullscreen at 1280x800 by default on Deck, UI scaled for 16:10 (use Godot `canvas_items` stretch with `expand` aspect), and test 1280x720 and ultrawide. | [V S56, S61] [I] Godot specifics |
| R71 | MUST make the smallest UI font 9 px or more at 1280x800 in actual screen pixels, after Godot scaling, and target 12 px. Pixel-art style font sizes and the Trivet small caps labels are the likely failure. Include a text size option. | [V S56] |
| R72 | MUST provide a default Steam Input / gamepad layout where every menu, shop, save and dialogue can be reached with the Deck's controls without the trackpad pointer. Godot sees Deck input as a gamepad; the default layout must be uploaded and set as the default config. | [V S56] [I] |
| R73 | MUST swap glyphs live between keyboard/mouse and gamepad, and never show keyboard prompts when a Deck input is used. Do not hardcode "Press E". | [V S56] |
| R74 | MUST open the on-screen keyboard for every text field (player name, save name, console) via the Steamworks text-input call. A Godot `LineEdit` alone will not open it on desktop. | [V S56, S61] [I] for Godot behaviour |
| R75 | MUST remove any pre-launch "click to continue", splash or legal screens that need a mouse; no launcher; no hardware warning. | [V S56] |
| R76 | MUST reach 30 fps at 800p in the **default** settings in the densest city scene, with the actor count the spike measured as the worst case (201 actors, 26 fps 1 percent low on a desktop GDScript baseline). The native sim and activity bubble in the city-scale plan are what make this plausible. | [V S56] [I] link to spike |
| R77 | SHOULD avoid media codecs outside Godot's Ogg Theora video; ship cutscenes as in-engine, which the pitch already specifies ("in-engine top-down cinematic, no pre-rendered video"). | [V S61] [I] |
| R78 | SHOULD request the Deck review for an unreleased title as soon as the build passes build review, and again after the final build. The Deck branch for review can be chosen at submission. | [V S56] |

Typical Godot-on-Proton failure modes to test first [I, from the criteria above]: tiny fonts at low resolution; keyboard glyphs on a gamepad build; `LineEdit` without a keyboard call; D3D12 driver under vkd3d; unsupported window mode at 1280x800; settings saved to Steam Cloud and overriding device resolution; first-run dialogs; save path under a non-writable folder; controller disconnect on suspend; unplugged-network first launch.

## 11. Legal artifacts

| # | Rule | Evidence |
|---|---|---|
| R90 | MUST include the **Godot MIT licence text** and the third-party licences bundled in the engine, in the game. Godot's page: "the only requirement is to include the license text somewhere in your game"; third-party libraries (for example FreeType and others listed in the thirdparty README) need their copyright notices. Accepted places: credits screen, licences menu, accompanying file, log output, or a link to godotengine.org/license. Use `Engine.get_license_info()`, `Engine.get_license_text()`, `Engine.get_copyright_info()` to keep it current, or ship `COPYRIGHT.txt` renamed `GODOT_COPYRIGHT.txt`. Not legal advice per Godot. | [V S62] |
| R91 | MUST include the **GodotSteam** licence (MIT, `license.md`, repository now on Codeberg; Godot 4.x edition). Also credit the Steamworks SDK redistributables per the SDK Access Agreement (login-gated, not read). | [V S63] [I] for SDK terms |
| R92 | MUST list licences for fonts (OFL fonts require the licence text with redistribution), music, sound effects and any plugin, in one `THIRD_PARTY_NOTICES.md` shipped with the build and shown in Credits. Add AI-tool names under "AI-assisted content" to match the survey. | [I] |
| R93 | EULA: Steam's default is the **Steam Subscriber Agreement**, accepted by the customer when buying ("Product offered subject to your acceptance of the SSA"). A custom EULA is optional; the Steam store hosts per-app EULAs (URL pattern `store.steampowered.com/eula/<appid>_eula_0`). Recommendation: no custom EULA for 1.0 unless a lawyer wants one. If you add one, say so on the store page; players object to silent EULA changes. | [V S64] [V2 S65] [I] |
| R94 | MUST publish a privacy policy if the game sends anything off-device (crash reports, telemetry, analytics, cloud AI). Valve's Privacy Policy covers Steam, not your own servers. With no network calls, say "the game collects no personal data" on a one-page policy on your own site and link it in the Basic Info website field (descriptions cannot contain links). Whether Steamworks has a mandatory privacy-policy URL field was not verifiable. | [V S18] [I] |
| R95 | MUST understand refunds. Steam refunds for any reason within 14 days of purchase and under 2 hours of playtime; you do not set this and a EULA cannot change it. DLC and bundles follow the same rules. Refund rate and reasons are in your sales report. At a 5-hour game, only the first two hours are refundable, so the first 20 minutes decide the rate. | [V S66, S67] |
| R96 | MUST add Steam legal attribution wherever you use the Steam logo (use approved Valve art only, standing alone, with "(c)2026 Valve Corporation. Steam and the Steam logo are trademarks..."). Do not imply Valve endorsement; Steam Deck badges follow the Deck brand guidelines (last updated 2022-05-02). | [V S68] |
| R97 | MUST NOT use real DoD seals, service insignia or real military unit marks in the Pentagon finale; see section 14. | [V2 S69] [I] |

## 12. Pricing and discounts (brief)

- Prices are set in 37 currencies and 4 region groups; Steamworks offers three conversion methods (exchange rate, purchasing power, multi-variable). **A missing currency price makes the game unavailable in countries that use it.** Initial pricing and changes are reviewed by Valve, usually in 1-2 business days. Needs "Manage pricing and discounts". [V S70]
- Minimum base price: the $0.99 tier by multi-variable conversion; lowest transaction price is half of that (about $0.49). [V S70]
- Price changes: wait 30 days after release. A price **increase** blocks discounting for 30 days. Price changes cannot be scheduled; you publish after Valve's review. [V S70, S71]
- Launch discount: optional, set near the release date, 7-14 days, **max 40 percent**, Valve suggests 10-15 percent; no other discount in the first 30 days; discounts must be 10-95 percent and 1-14 days; 30 days between discounts except seasonal sales; 20 percent or more triggers wishlist emails. [V S71]
- Revenue share, payment cadence: sales are paid about 30 days after they are made, monthly, if over $100. Revenue split not read from a public page. [V S72] [I] split
- Decision for the owner: a 5-hour game in this niche is usually priced low (see open questions). Run regional pricing review instead of accepting defaults. [I]

## 13. Metadata artifacts manifest

Proposed home: `games/gtai/steam/` (paths below are suggestions; track status in `games/gtai/steam/manifest.json`). "Owner": **H** = the human owner, **C** = a Claude/codex session or PoF pipeline, **V** = Valve portal action, **L** = lawyer or accountant. "Needed" is relative to release day T.

| # | Artifact | Spec | Source / how produced | Owner | Needed |
|---|---|---|---|---|---|
| 1 | Steamworks partner account, NDA + SDA signed | legal first+last name or entity | partner.steamgames.com onboarding | H | T-26w |
| 2 | Bank + tax record (W-9 or W-8BEN) | name matches ID | tax interview | H | T-26w |
| 3 | Identity document and selfie | JPEG, ID legible | phone | H | T-26w |
| 4 | App fee receipt and App ID | $100; App ID recorded in repo | Steam payment | H | T-24w |
| 5 | Final game name decision memo | trademark-cleared | lawyer + pitch | H+L | before store page review |
| 6 | Logo (vector master + PNG) | transparent PNG, 1280 wide or 720 tall | built in code from Trivet type; not model-typed | C | T-20w |
| 7 | Header capsule | 920x430 | key-art crop + logo | C | T-16w |
| 8 | Small capsule | 462x174, legible at 120x45 | logo-dominant | C | T-16w |
| 9 | Main capsule | 1232x706 | key art + logo | C | T-16w |
| 10 | Vertical capsule | 748x896 | key art + logo | C | T-16w |
| 11 | Library capsule | 600x900 | key art + logo | C | T-16w |
| 12 | Library header | 920x430 | same as 7 | C | T-16w |
| 13 | Library hero | 3840x1240 PNG, no text, safe area 860x380 | key art | C | T-16w |
| 14 | Library logo | PNG transparent, 1280w or 720h | from 6 | C | T-16w |
| 15 | Shortcut icon | 256 or 512 square, ICO/PNG | from logomark | C | T-16w |
| 16 | App icon | 184x184 JPG | logomark, no alpha | C | T-16w |
| 17 | Page background (optional) | 1438x810 | dim key art | C | T-12w |
| 18 | Event cover + header | 800x450; 1920x622 | announcements | C | T-12w (first event) |
| 19 | Screenshots, 5+ | 1920x1080 min, 16:9, gameplay only, 4+ all-ages | scripted capture from build | C | T-14w; refresh T-6w |
| 20 | Trailer 1 (gameplay) | up to 1080p, 30/60 fps, H.264+AAC, 5+ Mbps, 44.1/48 kHz | capture + edit | H+C | T-14w |
| 21 | Trailer gore-trimmed variant | country-restricted | edit | C | T-6w |
| 22 | Short description | plain text, a few hundred characters, no dates | writing | C | T-16w |
| 23 | About This Game + description images | 1170 px wide images/GIFs, <5 MB each, <15 MB total, alt text, no links | writing | C | T-16w |
| 24 | Tags, ordered (5 min, 20 max) | Tag Wizard | owner choice | H | T-16w |
| 25 | Languages matrix | interface/audio/subtitles per language | as shipped | H | T-8w |
| 26 | System requirements (min/rec, per OS) | measured | benchmark run | C | T-8w |
| 27 | Controller declaration + accessibility wizard | honest | test matrix | H | T-6w |
| 28 | Content survey answers (General, Mature, AI) | saved copy in repo | content disclosure sheet | H | T-6w |
| 29 | AI disclosure text + provenance log | tools, categories, process | log under `steam/ai-provenance/` | C+H | T-6w |
| 30 | Content disclosure sheet | violence, profanity list, drugs, sex | design baseline | C | T-8w |
| 31 | Optional board ratings | only if issued on shipped build | none planned | H | n/a |
| 32 | Depot and launch config | depot IDs, OS, launch options | General Installation Settings | H | T-6w |
| 33 | `app_build_<APPID>.vdf`, `depot_build_*.vdf`, `upload.ps1` | SteamPipe scripts with exclusions | repo `games/gtai/steam/build/` | C | T-8w |
| 34 | Godot export presets (Windows, optional Linux) + PCK split plan | no PCK encryption, no embedded PCK | repo | C | T-8w |
| 35 | Release candidate build on `default` and `internal` branches | near-final | steamcmd | C | T-4w |
| 36 | Deck test report + default controller config | 1280x800, 9/12 px, glyphs, keyboard, 30 fps | real Deck | H | T-6w, repeat T-2w |
| 37 | `THIRD_PARTY_NOTICES.md` + in-game credits + Godot licence | MIT text, third-party notices, GodotSteam MIT, fonts, AI tools | scripted from `Engine.get_license_info()` | C | T-8w |
| 38 | Privacy policy page | one page, on own site | writing | H | T-8w |
| 39 | EULA (optional) | skip for 1.0 unless advised | lawyer | L | T-8w |
| 40 | Price table 37 currencies + launch discount plan | USD base, regional review | pricing page | H | T-4w |
| 41 | Demo app and demo build (if Next Fest) | separate App ID, own review | repo | H+C | 3 weeks before Fest |
| 42 | Store page, build review submissions | both checklists complete | Steamworks | H+V | T-4w, T-3w |
| 43 | Coming Soon publish (store beta checked first) | >= 2 weeks live | Steamworks | H | T-16w |
| 44 | Launch announcement + patch-notes template | event cover 800x450 | writing | C | T-1w |
| 45 | Trademark and IP clearance memo (name, GTA references, Pentagon) | lawyer sign-off | counsel | L | T-20w |

## 14. Risks specific to this game

**Content (store and rating).**
1. Violence and profanity are the product; they are allowed (Hotline Miami and Postal 2 ship with these descriptors) but carry the "Frequent Violence or Gore" and "General Mature Content" labels, 18+ Steam ratings in Germany, Brazil and Indonesia, and a filter-based visibility cost. [V S26]
2. "Politically incorrect" collides with Valve's hate-speech and "patently offensive or intended to shock or disgust" clauses. Keep a satire memo showing targets and intent per questionable joke. [V S1]
3. Drug mechanics rewarded as power-ups are an Australian RC trigger; sexual violence is refused or restricted in Australia and Germany. Avoid both. [V S37]
4. Indonesia may ban it (Postal 2 precedent, n=1). Loss is regional. [V S26, S36]
5. Marketing assets are PG-13 only; screenshots need 4+ clean all-ages frames; the trailer is the place for the real violence, possibly country-split. [V S10, S11, S15]
6. Content in the build that is "not accessible" still has to be disclosed (cut content, debug rooms, dev menus). [V S25]

**Legal.**
7. **Name risk.** "GTAI" is one letter from "GTA", a Take-Two mark. I found no case of Take-Two suing an indie over a GTA-like name; I found Take-Two forcing a trademark withdrawal on "It Takes Two" (2021), DMCA takedowns of GTA mods, and a copyright claim on GTA-style key art in a UEFN trailer. The name locks at first store review. Get a trademark search and a lawyer's opinion before T-20w; have a fallback title ready. [V2 S73, S74] [I] for conclusions
8. **Trade dress and marketing.** Valve forbids references to or ads for other Steam products in descriptions and capsules; "GTA 2 lineage" therefore must not appear in store text. Top-down camera, crime sandbox and wanted-level mechanics are genre conventions, not protectable ideas; copying GTA 2 key art, logo layout, cop-car designs or character designs is the risk. Do not ship GTA-like fonts, colors or logo composition. [V S18] [I]
9. **Real institutions.** Satire of the US military and a Pentagon raid is protected speech in principle but Valve also bans "libelous or defamatory statements." Use a fictional contractor (the pitch uses a fictional factory firm) and invented unit names. DoD says its seals, logos and insignia need permission for commercial use and may not imply endorsement; use no real seals, service insignia, service-branch trademarks, or real officials' names or likenesses. The building's outline alone is generic; label buildings fictionally if in doubt. [V2 S69] [I]
10. **Real brands and people** in the city (billboards, shops): use invented brands only.

**AI disclosure.**
11. The shipped build contains AI-generated art (Nano Banana, OpenAI images), AI voices and LLM-assisted text; all three categories require disclosure and Valve may print it on the page. Non-disclosure can be treated as a breach of the SDA (secondary reading). [V S25] [V2 S33]
12. Training-data provenance: Valve rejected a 2023 AI-art game over unclear rights before it adopted the current policy; today it reviews output like any other content. Keep provenance logs; avoid style prompts naming artists or franchises; run an output check for look-alikes of GTA art. [V2 S34] [V S25]
13. AI-generated marketing material (capsules, trailer) counts toward disclosure; the capsule logo should be human-composited. [V2 S32]
14. US copyright protection for pure AI output is uncertain; do not rely on the art being protectable. [I S35]

**Platform/technical.**
15. Deck Verified is realistic only if text, glyph and keyboard criteria are designed in early. Godot-on-Proton defaults (D3D12 on Windows from 4.6) and a 200-actor city make the 30 fps gate the hard criterion. [V S56] [V2 S60]
16. A 5-hour game gives players two refundable hours; weak early pacing is the largest financial risk after discovery. [V S66]

## 15. Release timeline (T = release day, a Tuesday to Thursday)

Today is 2026-11-02. The earliest feasible T given the gates is about T = today + 6 weeks, but the game is far from that, so T-minus planning follows. Next Fest and Valve-fixed dates are absolute.

| When | Action |
|---|---|
| T-26w or earlier | Onboard: identity, bank, tax, NDA/SDA. Start the tax clock (up to 30 days). Create a build account. |
| T-24w | Pay the $100 fee (21-day wait starts). Get the App ID. Start the trademark search and name memo. |
| T-22w | Name decision locked. Content disclosure sheet started. Pick Next Fest edition (February 22 to March 1, 2027 or June 14 to 21, 2027; decide by registration deadline: January 10, 2027 for the first). |
| T-20w | Logo and key art. Capsule set drafted. Lawyer opinion on name and finale. |
| T-18w | Store page content complete in Steamworks: description, tags, system requirements, languages, accessibility, controller. Content survey drafted. |
| T-16w | Submit store presence for review (7 business days before you want it live). Fix feedback. **Publish Coming Soon** (at least 2 weeks before release; earlier is better). |
| T-14w | First gameplay trailer and 5+ screenshots live. Community Hub posts start. |
| T-12w | Demo build (if Next Fest): separate App ID; submit demo for review at least 3 weeks before the Fest. |
| T-10w to T-8w | Depots, launch options, steamcmd scripts, PCK split, licences and credits in game. First Deck run on a real device; fix text size, glyphs, keyboard. |
| T-6w | Content survey final (including AI). Deck test report. Privacy policy live. Pricing table prepared. Request/pass build review path. |
| T-5w | Upload a near-final build to `default`; confirm every ticked feature works on every ticked OS. |
| T-4w | Submit build for review (store presence already approved). Plan 7 business days. |
| T-3w | Request Deck compatibility review (after build review passes). Release date locked by T-2w (cannot be changed inside the final two weeks). |
| T-2w | Coming Soon has been public at least 2 weeks. Confirm no trailer is converting. Review Deck results; publish or fix and re-test. |
| T-1w | Launch announcement drafted; launch discount (10-15 percent, 7-14 days, max 40 percent) set if wanted; both release permissions on the releasing account; sales report access confirmed. |
| T | "Release App" yourself in a weekday window; watch error reporting and refunds; keep `hotfix` branch ready. |
| T+30d | Discounts and price changes allowed again. Add languages as updates with an Update Visibility Round. |

## 16. Sources (all accessed 2026-11-02)

Primary (Valve Steamworks docs, readable without login):
- S1 https://partner.steamgames.com/doc/gettingstarted/onboarding
- S2 https://partner.steamgames.com/doc/gettingstarted/faq
- S3 https://partner.steamgames.com/doc/gettingstarted/appfee
- S4 https://partner.steamgames.com/doc/store/coming_soon
- S5 https://partner.steamgames.com/doc/store/editing/name
- S6 https://partner.steamgames.com/doc/store/localization
- S7 https://partner.steamgames.com/doc/sdk/uploading
- S8 https://partner.steamgames.com/doc/gettingstarted/documents
- S9 https://partner.steamgames.com/doc/store/assets/rules
- S10 https://partner.steamgames.com/doc/store/assets
- S11 https://partner.steamgames.com/doc/store/assets/standard
- S12 https://partner.steamgames.com/doc/store/assets/libraryassets
- S13 https://partner.steamgames.com/doc/store/assets/community
- S14 https://partner.steamgames.com/doc/store/assets/eventassets
- S15 https://partner.steamgames.com/doc/store/trailer
- S16 https://partner.steamgames.com/doc/store/page/assets
- S17 https://partner.steamgames.com/doc/store/page/description
- S18 https://partner.steamgames.com/doc/store/page/description (rules section) and https://partner.steamgames.com/doc/store/page
- S19 https://partner.steamgames.com/doc/store/review_process
- S20 https://partner.steamgames.com/doc/store/tags
- S21 https://partner.steamgames.com/doc/accessibility_features
- S22 https://partner.steamgames.com/doc/store/localization (languages and depots)
- S23 https://partner.steamgames.com/doc/marketing/visibility
- S24 https://partner.steamgames.com/doc/store/page (controller support listed under Basic Info)
- S25 https://partner.steamgames.com/doc/gettingstarted/contentsurvey
- S26 Live store data: https://store.steampowered.com/api/appdetails?appids=219150 (also 223470, 271590) and https://store.steampowered.com/app/219150/
- S27 https://partner.steamgames.com/doc/store/age_gate
- S28 https://partner.steamgames.com/doc/gettingstarted/contentsurvey/germany
- S36 https://partner.steamgames.com/doc/gettingstarted/contentsurvey/indonesia
- S39 https://partner.steamgames.com/doc/store/releasing
- S40 https://partner.steamgames.com/doc/gettingstarted/onboarding (1-5 days)
- S41 https://partner.steamgames.com/doc/store/release_dates
- S42 https://partner.steamgames.com/doc/store/page (publishing warning)
- S43 https://partner.steamgames.com/doc/store/coming_soon (timing section); https://partner.steamgames.com/doc/marketing/wishlist
- S44 https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest
- S45 https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027
- S46 https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/june_2027
- S47 https://partner.steamgames.com/doc/marketing/wishlist
- S48 https://partner.steamgames.com/doc/marketing/visibility
- S49 https://partner.steamgames.com/doc/store/application/depots
- S50 https://partner.steamgames.com/doc/store/application/branches
- S51 https://partner.steamgames.com/doc/store/testing
- S52 https://partner.steamgames.com/doc/features/drm
- S53 https://partner.steamgames.com/doc/steamhardware/proton
- S55 https://partner.steamgames.com/doc/features/common_redist
- S56 https://partner.steamgames.com/doc/steamhardware/compat (Deck and Machine criteria, process, FAQ)
- S58 https://partner.steamgames.com/doc/store/application/platforms and https://partner.steamgames.com/doc/store/application/platforms/linux
- S59 https://partner.steamgames.com/doc/steamhardware/recommendations (also S61)
- S64 https://partner.steamgames.com/doc/marketing/branding (SSA text, attribution, Deck brand guidelines)
- S66 https://store.steampowered.com/steam_refunds/
- S67 https://partner.steamgames.com/doc/finance/refunds
- S70 https://partner.steamgames.com/doc/store/pricing
- S71 https://partner.steamgames.com/doc/marketing/discounts
- S72 https://partner.steamgames.com/doc/finance/payments_salesreporting
- S37 Australia: Guidelines for the Classification of Computer Games 2023 (F2023L01424), https://legislation.gov.au/F2023L01424/asmade/2023-10-27/text/original/pdf
- S62 Godot: https://docs.godotengine.org/en/stable/about/complying_with_licenses.html
- S63 GodotSteam (MIT, Godot 4.x, Codeberg): https://codeberg.org/godotsteam/godotsteam ; latest release v4.23.2 (2026-10-20) via https://api.github.com/repos/GodotSteam/GodotSteam/releases/latest ; Godot 4.7.2-stable (2026-08-18) via https://api.github.com/repos/godotengine/godot/releases/latest
- S68 https://partner.steamgames.com/doc/marketing/branding

Secondary or lower reliability:
- S29 https://gamingonlinux.com/2024/10/from-november-15-all-steam-games-sold-in-germany-will-need-an-age-rating/ (found via search, not fetched in full)
- S30 Community threads on adult-only default visibility, e.g. https://steamcommunity.com/discussions/forum/0/3821910883983994025/
- S31 https://gamefromscratch.com/steam-makes-massive-update-to-ai-generation-policy/ (quotes Valve's January 2024 post)
- S32 https://moexplains.com/steam-ai-disclosure-rules-2026-update/ and https://www.tweaktown.com/news/109743/valve-changes-ai-disclosure-guidelines-ai-powered-tools-are-now-exempt/index.html (January 2026 rewrite, as found by search)
- S33 https://legalmoveslawfirm.com/steam-ai-policy/ (January 17, 2026 rewrite, exemptions, store-page placement)
- S34 Same gamefromscratch article (2023 rejection letters, quoted from a developer's post)
- S35 https://www.copyright.gov/ai/ (US Copyright Office AI reports; not read for this file, linked for follow-up)
- S38 https://www.notebookcheck.net/Schedule-I-restricted-on-Steam-in-Australia-due-to-classification-issue.1019089.0.html
- S54 https://forum.godotengine.org/t/encrypted-linux-exports-do-not-run-with-linux-runtime-on-steam-deck/143959
- S57 Godot Steam Deck tutorial summary (search result): https://assets.carolus.raywenderlich.com/41495624-targeting-the-steam-deck-with-godot/page/3
- S60 https://gamingonlinux.com/2026/01/the-free-and-open-source-godot-engine-4-6-is-out-now-with-major-upgrades
- S65 Unreal forum thread on per-app EULA display: https://forums.unrealengine.com/t/default-eula/356324 ; example per-app EULA URL https://store.steampowered.com//eula/2836120_eula_0
- S69 DoD branding guidance found via search: https://www.trademark.marines.mil/Portals/161/Docs/DOD%20Trademark%20Licensing%20Guide-16%20July%202017_1.pdf and https://download.militaryonesource.mil/12038/Style%20Guide/MCFP-DODlogoGuideline.pdf (cites DoDI 5535.12 and 10 U.S.C. 2260; I did not read the instruction itself)
- S73 https://www.pushsquare.com/news/2021/12/publisher-take-two-forces-it-takes-two-dev-hazelight-to-abandon-title-trademark
- S74 https://pcgamer.com/take-two-has-been-issuing-takedowns-for-gta-mods and https://www.gtaboom.com/take-two-appears-to-have-already-killed-the-gta-clone-trailer-96e1

## 17. Open questions

1. **Title.** Is "GTAI: Uprising" the final Steam name? A one-letter distance from a famous mark, locked at first review. Needs counsel and a fallback title. (Owner + lawyer)
2. **Legal entity.** Sole proprietor under your legal name or a company? It controls the name on bank, tax and the SDA; changing it later means re-onboarding and an IP transfer. Which country (drives W-9 versus W-8BEN and TIN lead time)? (Owner)
3. **Release window.** Which Next Fest edition (February 22 to March 1, 2027 needs a public demo and a public store page by January 10, 2027 for registration, which looks too early; June 14 to 21, 2027 is likelier)? One Next Fest per game, ever. (Owner)
4. **Native Linux or Proton only?** Recommendation is Windows only plus Proton on Deck, adding Linux only if Proton underperforms. Needs a real Deck to decide. (Owner)
5. **Language set at 1.0.** English only plus subtitles? Is any VO shipped (TTS counts as AI audio)? (Owner)
6. **Which AI uses ship?** Confirm the final list: art parts, key art, TTS, LLM text, AI localization, AI trailer elements. The disclosure must match the build. (Owner + C)
7. **Australia and Germany stance.** Accept regional loss, or tune content (toggle for gore, no drug rewards)? Should the owner pursue a formal Australian classification? Steam is not an IARC store, so the route and fee were not verified here. (Owner)
8. **Default filter behaviour** for "Frequent Violence or Gore": not verified; test on a fresh account after the page is public. (C)
9. **Controller declaration and Steam Input config:** Full or Partial? Depends on the Deck pass. (C)
10. **Price.** USD base for a 5-hour top-down title; whether to run a launch discount; regional pricing method. (Owner)
11. **Privacy policy requirement.** Is there a mandatory URL in the Basic Info form, and does Valve's error-reporting feature require disclosure? Not readable without login. (Owner, check in portal)
12. **Revenue split and SDA terms.** Not on a public page I could read; read the SDA during onboarding. (Owner)
13. **Steam page text on AI.** Valve may print the disclosure; owner decides the tone. (Owner)
14. **Third-party AI terms.** OpenAI and Google image/voice output terms for commercial use and any attribution; not checked here. (Owner + C)
