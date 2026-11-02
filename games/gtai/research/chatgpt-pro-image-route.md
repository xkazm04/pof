# Can the ChatGPT Pro plan feed GTAI's art pipeline? (research, 2026-11-02)

Scope: use the owner's ChatGPT Pro subscription (no API credits) for generation and editing of GTAI character parts via OpenAI's image model.
Method: local probing (Codex CLI 0.160.0, one live test generation) plus web research. "VERIFIED" = seen in a command output or an official OpenAI page fetched today. "REPORTED" = third-party source. "UNVERIFIED" = could not confirm.

## 1. Model name: "GPT 2.5 Sunburst"

- VERIFIED: the model is real and "Sunburst" is its public name, not a codename. It is **GPT Image 2.5 Sunburst**, API id `gpt-image-2.5-sunburst` (snapshot `gpt-image-2.5-sunburst-2026-09-08`). Source: https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst.md
- It is one of a pair released 2026-09-08 as **GPT Image 2.5**: `gpt-image-2.5-flare` (fast default, "50% lower latency" than GPT-Image-2) and `gpt-image-2.5-sunburst` (precision tier, "Choose Sunburst for workflows where editing precision matters most"). Sources: https://developers.openai.com/api/docs/guides/image-generation, https://openai.com/index/introducing-chatgpt-images-2-5/ (page returned 403 to fetch; content seen via search summary), https://community.openai.com/t/introducing-gpt-images-2-5-in-the-api-and-chatgpt/1395897
- The consumer product is branded **ChatGPT Images 2.5** (successor to ChatGPT Images 2.0 / `gpt-image-2`, April 2026). Help article: https://help.openai.com/en/articles/11084440-images-in-chatgpt ("ChatGPT Images 2.5 brings sharper details, more precise editing, and faster image generation"; "make the background transparent" is supported).
- Official model spec (Sunburst): quality `low|medium|high|xhigh|max|auto`; image input and output; endpoints images/generations, images/edits, batch; inpainting; API price image output $30/M tokens ($15 batch). Sizes (API guide): custom WxH, multiples of 16, max edge 3840, 655,360-8,294,400 px, aspect 1:3 to 3:1, above 2560x1440 "experimental". Transparent background via `background:"transparent"` with png/webp, both 2.5 models.
- Flare vs Sunburst in ChatGPT/Codex: OpenAI says Images 2.5 is rolling out to "ChatGPT, ChatGPT Work, and Codex users across all tiers" but, in everything fetched, **does not say which tier serves ChatGPT or Codex, and there is no model picker**. A Pro subscriber reports Codex output PNG metadata says only `gpt-image` (community thread above). The safety system card names neither as the ChatGPT/Codex default (https://deploymentsafety.openai.com/chatgpt-images-2-5).

## 2. Route 1: Codex CLI (installed, logged in with the plan)

**Verdict: WORKS (headless, plan-billed).** Best route.

Local evidence:
- `codex --version` = 0.160.0. `codex features list` shows `image_generation stable true`, `view_image stable true`.
- `~/.codex/auth.json`: `auth_mode = chatgpt`, no `OPENAI_API_KEY` stored (checked key names only; no secrets printed). So generations draw on the plan, not API billing.
- 27 earlier headless images already sit in `~/.codex/generated_images/<session>/exec-*.png` (1672x941, RGB), from an Oct 2 run. The built-in tool is evidently in routine use here.
- **Probe run (1 image, today):** `codex exec --skip-git-repo-check -s workspace-write --json -o last_message.txt -C <dir> "<prompt first>"` with the prompt "red riveted robot fist, top-down, risograph, flat #00B140 background". Exit 0, ~1.5 min wall, 85.7k input tokens (72k cached) / 962 output on the agent model (plan quota, no key).
  - Codex auto-loaded its `imagegen` skill (`~/.codex/skills/.system/imagegen/SKILL.md`) and called the built-in `image_gen` tool.
  - File landed at `C:\Users\kazda\.codex\generated_images\01a19bb8-aa70-7353-8606-c278f4e417bf\exec-8d2af05a-4b8c-4072-b5b4-00a0b86a9298.png`; the agent copied it to `C:\Users\kazda\kiro\gtai-spike\gpt-image-probe\probe1.png`.
  - Output: **1312 x 1199 PNG, RGB (no alpha)**. Background was near-flat green, measured (1,175,65) typical, corners (2,177,71)...(1,173,66), vs target (0,177,64): off by up to ~±5 per channel, so it keys cleanly with a tolerance but is not exactly #00B140. Quality: strong riso-style crayon/stipple texture, rivets crisp, no shadow, no text. It ignored "top-down 90 degrees": the fist is a front/three-quarter view, so the camera angle needs stronger prompting or a reference.
  - C2PA metadata is embedded (claim generator "OpenAI Media Service API", softwareAgent `ChatGPT` version `gpt-image`, `trainedAlgorithmicMedia`). The model tier (Flare/Sunburst/2.0) is **not** recorded anywhere I could read: UNVERIFIED which model served it. The agent also said the tool does not report it.
- Saving to disk: the tool always writes under `$CODEX_HOME/generated_images/<thread>/`; the agent copies/moves into the workspace on request (the skill's rule: user-named destination wins). Headless is fine; just have the prompt say "copy to <path>" or collect from `generated_images` by session id (the `--json` stream does not surface the image path; the final message did).
- Input images: `-i/--image <FILE>...` exists on `codex exec` (verified in `--help`). Docs: "In the CLI, attach an image with -i"; multiple references should be labelled by order (https://learn.chatgpt.com/docs/image-generation). I did NOT test `-i` (one-generation limit): UNVERIFIED in practice. Variadic flag: put the prompt first or use `--`.
- Editing: the skill's built-in mode edits only images already in the conversation (attached via `-i` or loaded with `view_image`); masks and file-path controls are CLI-fallback-only and need an API key (https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/imagegen/SKILL.md). Natural-language "change only X, keep Y" edits work.
- Transparency: the skill says to ask the built-in tool for a "genuinely transparent background and preserve alpha" (so supported in principle); my probe asked for green, not transparency, and got RGB. For our pipeline chroma green is the intended path anyway. REPORTED: a third-party client verified RGBA transparency through the same backend on 2026-11-01 (https://github.com/the-jey/codex-sub-imagen); another reported it required API-key mode on 2026-09-11 (https://github.com/LeemanCheung/dsh-image-gen). Conflicting, so test before relying on it.
- Resolution: the Codex backend picks size and quality itself. REPORTED outputs: 1774x887, 1536x1024 (dsh-image-gen); VERIFIED here: 1312x1199 and 1672x941 (earlier). Not the 3840 API ceiling. Treat as roughly 1.5-2 MP per image, upscale separately if needed.
- Batch: one image_gen call per asset (skill: the word "batch" does not switch to the API path). Each image costs a whole agent turn (~85k tokens, ~1-2 min), so throughput is serial-ish; parallel `codex exec` processes are possible but untested and quota-sensitive.
- Cost/limits (VERIFIED, https://learn.chatgpt.com/docs/pricing, https://learn.chatgpt.com/docs/image-generation): Codex image generation counts against general Codex limits, consuming them "roughly 3-5x faster" than a text turn; after the included limit it draws credits; it is API-billed only if an API key is used. Built-in model per these docs: `gpt-image-2` (docs have not been updated for 2.5). Codex help says ChatGPT-web image caps ("50 images in the last day") do not apply to Codex (https://help.openai.com/en/articles/11369540-codex-and-chatgpt-plan-usage-limits). Pro plans have "no five-hour limit" but a weekly allowance; exact image counts not published.
- Can we force Sunburst? Not through documented Codex CLI settings. REPORTED: third-party tools call the same ChatGPT Codex backend directly (`https://chatgpt.com/backend-api/codex/...`) with the Codex OAuth token and can name `gpt-image-2.5-sunburst`, but that reuses the CLI's private credentials outside OpenAI's client; treat as unsupported and a ToS grey zone (see section 6). I did not do it.

## 3. Route 2: ChatGPT desktop app / chatgpt.com driven by Claude

**Verdict: PARTIALLY WORKS technically; do NOT recommend. Research only, nothing was opened or automated.**

- Feasibility: ChatGPT web does offer everything we want (references via upload, "make the background transparent", inline edit-a-region, Canvas view, download). Claude in Chrome / computer use / Playwright could in principle upload, prompt, wait for the render and save the download. Whether the web UI routes to Flare or Sunburst is not user-selectable (community thread above: Flare is the lighter default; escalation to Sunburst is the commenter's unconfirmed guess).
- Limits: Pro images are advertised as "unlimited and faster image creation" **subject to abuse guardrails** (https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers, pricing page). No numeric cap is published; users report hard caps ("resets in 720 hours") even on paid plans (https://community.openai.com/t/image-creation-limit-720-hour-wait/1340856), which is the realistic failure mode for batch use.
- Fragility: DOM selectors change, bot checks, per-image download of full-res assets, moderation false positives reported by users, and no completion API. High maintenance.
- Terms: the consumer Terms prohibit "Automatically or programmatically extract[ing] data or Output" and the Pro help page says "Sharing account credentials, reselling access and automatically extracting data are prohibited. We may restrict access for misuse." Bulk automated driving of the web UI to harvest images squarely resembles this clause (section 6). A ban risk to the owner's main account is not worth it when Route 1 exists.

## 4. Route 3: other plan-covered surfaces

- **Codex desktop app / IDE extension:** same backend and same built-in tool as the CLI (docs: invoke from app composer, web, CLI `$imagegen`, IDE extension). No headless advantage over `codex exec`. WORKS but redundant.
- **Codex as an MCP/app server:** `codex mcp` here only manages external servers (list/get/add/remove/login). `codex app-server` is [experimental] and exposes the Codex protocol (daemon, TypeScript/JSON-schema generators). No official "image generation MCP server" backed by the plan was found. Could be used to drive Codex programmatically instead of shelling `exec` (UNVERIFIED for images).
- **OpenAI API (`gpt-image-2.5-sunburst`):** the only route with documented Sunburst, `background: transparent`, masks, 3840 px, multi-reference edits. It is separately billed, so it is excluded by the brief. Noted only as the fallback if the plan route's quality tier turns out to be insufficient (price per Sunburst model page: $30/M image-output tokens).
- Sora / apps connectors: nothing relevant to image-part generation found. UNVERIFIED.

## 5. Quality relative to our needs (summary table)

| Need | Codex `image_gen` via plan (Route 1) | ChatGPT web (Route 2) |
|---|---|---|
| Reference-image generation | Yes via `-i` (documented; untested here) | Yes (upload) |
| Edit / inpaint | Natural-language edit of attached/prior images; no masks without API key | Yes, region select + prompt |
| Flat chroma bg | Verified (near #00B140, +/-5) | Likely, untested |
| Transparent bg | Supported per skill; unverified in practice, conflicting reports | Supported per help article |
| Resolution | Backend-chosen, ~1.3-1.8 MP seen | Not published |
| Batch | One agent turn per image, 1-2 min, 85k tokens | Manual/fragile |
| Model tier | Not controllable; Sunburst unconfirmed | Not controllable |
| Cost | Plan quota (3-5x text burn) | Pro "unlimited" w/ guardrails |

Caveats from OpenAI's own docs: characters drift across separate generations and repeated edits can alter details meant to be preserved (Morphic summary of the OpenAI launch post). Consistency across sheets therefore needs reference images every call.

## 6. Terms of Service

Sources: https://openai.com/policies/row-terms-of-use/ (fetched 2026-11-02; the generic /terms-of-use page served the "Europe Terms of Use", updated January 16, 2026, with the same clauses) and https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers.

- Prohibited: "Automatically or programmatically extract data or Output (defined below)." (ROW terms; EU: "Automatically or programmatically extracting data or Output.") Also: "Interfering with or disrupting our Services, including circumventing any rate limits or restrictions or bypassing any protective measures or safety mitigations." And "Using Output to develop models that compete with OpenAI." Account credentials must not be shared.
- Browser/desktop automation of chatgpt.com (Route 2): my reading (inference, not legal advice) is that scripted harvesting of images through the consumer UI risks falling under the extraction clause and the Pro "abuse guardrails"; OpenAI states it "may restrict access for misuse." There is no official automation carve-out for the consumer app. Do not do it.
- Codex for non-coding assets (Route 1): Codex's help page says "When you sign in to Codex using an existing ChatGPT account, the ChatGPT Terms of Use and Privacy Policy ... govern" (https://help.openai.com/en/articles/11369540-codex-and-chatgpt-plan-usage-limits). Codex is OpenAI's own client; `codex exec` is its documented non-interactive mode, and image generation is an official, documented Codex feature billed to plan limits, with `$imagegen` documented for assets (textures, sprites, transparent cutouts per the skill description). I found no clause restricting non-coding use or scripted `exec` with plan login (the manual positions API-key as "great for automation in shared environments like CI" but does not forbid plan login). So Route 1 is the sanctioned automation path. Residual risk (inference): very heavy unattended looping could trip abuse guardrails or usage limits. Keep volume modest.
- Calling the private ChatGPT Codex backend directly with extracted OAuth tokens (what third-party tools do) is NOT the same as using the Codex client. I found no authorization for it; avoid.

## 7. Commercial rights and Steam

- Ownership (VERIFIED, OpenAI Terms): "As between you and OpenAI, and to the extent permitted by applicable law, you (a) retain your ownership rights in Input and (b) own the Output. We hereby assign to you all our right, title, and interest, if any, in and to Output." Caveat in the same terms: "Output may not be unique and other users may receive similar output." You must hold rights to your Input (reference images). The terms do not bar commercial use of Output; the "Representing that Output was human-generated when it was not" prohibition (EU version) is relevant to how the game is marketed. The business addendum applies if used commercially.
- Copyright: ownership vs OpenAI does not make the art copyrightable. The US Copyright Office's Part 2 report (2025-01-29, https://www.copyright.gov/ai/) addresses this; from prior knowledge (not re-fetched), purely prompt-generated output lacks sufficient human authorship while human selection, arrangement and modification can qualify. GTAI's slicing, rigging and compositing adds human authorship but the raw riso art may be thinly protected. Worth legal review before a sale.
- Provenance: output carries C2PA metadata and, per OpenAI's system card, SynthID watermarking across ChatGPT, Codex and API (VERIFIED in my probe PNG: C2PA present). Keying/slicing may strip it, but do not rely on that.
- Steam (https://partner.steamgames.com/doc/gettingstarted/contentsurvey): developers must disclose when they "used AI services during development or incorporates AI services as a part of the product", focusing on player-facing content. Art shipped in the game is "Pre-Generated AI" content: describe it in the Content Survey; Valve evaluates it like non-AI content in review; the game must not include illegal or infringing content and must match marketing. Efficiency-only tooling is out of scope. This applies equally to Nano Banana output, so adding a second source changes only the wording of the disclosure.

## 8. Recommendation

**Yes, add it as an optional second asset source, via Codex CLI only, with these conditions. It is not a Nano Banana replacement.**

Worth it because: zero extra cost, headless, reference images via `-i`, natural-language edits, near-flat chroma-green output, strong riso look, ownership assigned to us.
Limits that make it secondary: backend-chosen resolution (~1.3-1.8 MP), no model/tier control (Sunburst not confirmed), no masks, one slow agent turn per image, no camera-angle fidelity out of the box (top-down was ignored on the first try), and the plan's quota burns 3-5x faster than text.

Recipe (prompt FIRST, images after `--`; run from a scratch dir; one process at a time):

```
cd C:\Users\kazda\kiro\gtai-spike\<job>
codex exec --skip-git-repo-check -s workspace-write -o last_message.txt -C . \
  "Use the built-in image_gen tool (imagegen skill) to generate ONE image. Image 1 is the character reference sheet (keep the same character, palette, riso style). <part spec: e.g. right forearm + fist, TOP-DOWN 90 degrees straight down, isolated part, centred, margin all round>. Flat solid #00B140 background, no shadow, no text. Then copy the file to ./out/<name>.png and print the original path." \
  -i ref_sheet.png
```
(If `-i` swallows the prompt, use `... -i ref.png -- "<prompt>"`.) For edits, attach the image and say "Image 1 is the edit target; change only X, keep everything else unchanged."

Next steps before integrating (cheap, each one image): (a) test `-i` with a Trivet reference sheet for consistency, (b) test a top-down edit of a side-view shin, (c) test explicit "transparent background" for RGBA output, (d) key-out check on the green (+/-5 drift: use a tolerance of >=12 in the keyer), (e) try to determine the tier (compare detail at fixed prompt against Flare/Sunburst API samples if ever needed). If Codex output quality falls short, the paid `gpt-image-2.5-sunburst` API is the only route with documented Sunburst, masks, transparency and 4K; that violates the no-API-billing constraint, so it is the owner's call.

Do NOT: drive chatgpt.com with Claude in Chrome/Playwright; reuse Codex OAuth tokens in other clients.

## 9. Open questions / unverified

- Which tier (2.0 / 2.5 Flare / 2.5 Sunburst) Codex's built-in `image_gen` actually serves today. Official Codex docs still say `gpt-image-2`; the owner's observation of "Sunburst" on Pro could come from the ChatGPT web product. A third-party report says some Codex users saw `gpt-image` v2.0 in metadata.
- `-i` multi-reference behaviour and count limit in `codex exec` (third-party tool using the backend caps references at 4).
- RGBA output through `image_gen` (conflicting reports).
- Exact Pro image/Codex quota for repeated generation; OpenAI publishes none.
- The openai.com launch page and OpenAI help pages returned 403 to the fetch tool; I read terms and help pages with curl and a browser user agent.

## 10. Artefacts

- Probe image and event log: `C:\Users\kazda\kiro\gtai-spike\gpt-image-probe\` (`probe1.png`, `probe1.events.jsonl`, `last_message.txt`).
- Original Codex output: `C:\Users\kazda\.codex\generated_images\01a19bb8-aa70-7353-8606-c278f4e417bf\exec-8d2af05a-4b8c-4072-b5b4-00a0b86a9298.png`.
- No repo files were modified other than this report; not committed; no fleet-memory entry appended (read-only instruction).
