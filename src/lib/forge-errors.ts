/**
 * Pattern-matches a raw Forge failure (anything `caught` from a fetch/apiFetch
 * call) and returns a structured, user-readable card. The mapping is intentional:
 * every shape we know how to classify becomes an actionable, plain-English row;
 * everything else falls into the "Unknown error" bucket but still keeps the raw
 * `message` so the disclosure can show technical details.
 *
 * The classifier is pure — no React, no DOM — so it can be unit-tested in
 * isolation and reused anywhere an LLM-call error needs humanizing.
 */

/** Action affordance the UI should render alongside the explanation. */
export type ForgeErrorAction = 'retry' | 'edit-description' | 'configure';

/** A single canonical failure mode the forge can hit. */
export type ForgeErrorKind =
  | 'api-key-missing'
  | 'rate-limit'
  | 'network'
  | 'timeout'
  | 'json-parse'
  | 'schema-mismatch'
  | 'validation'
  | 'server-error'
  | 'unknown';

export interface ForgeErrorCard {
  kind: ForgeErrorKind;
  /** lucide-react icon name — caller imports + renders it. */
  iconName: 'KeyRound' | 'WifiOff' | 'Clock' | 'FileWarning' | 'AlertTriangle' | 'ServerCrash';
  /** Bold, plain-English title (3–6 words). */
  title: string;
  /** One-sentence cause, no jargon — what went wrong in user terms. */
  plainCause: string;
  /** Recommended next step. */
  actions: ForgeErrorAction[];
  /** Raw message preserved for the Technical details disclosure. */
  rawMessage: string;
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

export function classifyForgeError(err: unknown): ForgeErrorCard {
  const raw = toMessage(err);
  const m = raw.toLowerCase();

  // --- 1. API key not configured ----------------------------------------
  if (m.includes('api key') && (m.includes('not configured') || m.includes('missing') || m.includes('gemini_api_key'))) {
    return {
      kind: 'api-key-missing',
      iconName: 'KeyRound',
      title: 'AI key not set up',
      plainCause: "The forge can't reach the AI yet — your Gemini API key isn't configured in this project.",
      actions: ['configure'],
      rawMessage: raw,
    };
  }

  // --- 2. Rate limit / quota --------------------------------------------
  if (m.includes('rate limit') || m.includes('quota') || m.includes('too many requests') || /\b429\b/.test(raw)) {
    return {
      kind: 'rate-limit',
      iconName: 'Clock',
      title: 'AI service is busy',
      plainCause: 'The model is rate-limited right now. Wait a few seconds and try again.',
      actions: ['retry'],
      rawMessage: raw,
    };
  }

  // --- 3. Timeout -------------------------------------------------------
  if (m.includes('timeout') || m.includes('timed out') || m.includes('aborted') || m.includes('etimedout')) {
    return {
      kind: 'timeout',
      iconName: 'Clock',
      title: 'The AI took too long',
      plainCause: "We didn't hear back from the AI in time. The model may be slow — try again.",
      actions: ['retry'],
      rawMessage: raw,
    };
  }

  // --- 4. Network / fetch failure ---------------------------------------
  if (
    m.includes('failed to fetch') || m.includes('networkerror') || m.includes('econnrefused') ||
    m.includes('enotfound') || m.includes('network error') || m.includes("couldn't reach") ||
    err instanceof TypeError
  ) {
    return {
      kind: 'network',
      iconName: 'WifiOff',
      title: "Couldn't reach the AI",
      plainCause: 'Your network or the AI service is unreachable. Check your connection and try again.',
      actions: ['retry'],
      rawMessage: raw,
    };
  }

  // --- 5. JSON parse failure --------------------------------------------
  if (
    m.includes('failed to parse') || m.includes('json.parse') ||
    m.includes('unexpected token') || m.includes('not valid json') ||
    m.includes('parse gemini response')
  ) {
    return {
      kind: 'json-parse',
      iconName: 'FileWarning',
      title: 'The AI returned an unreadable answer',
      plainCause: "The model's reply wasn't valid JSON, so we couldn't turn it into an ability. Try again, or rephrase the description.",
      actions: ['retry', 'edit-description'],
      rawMessage: raw,
    };
  }

  // --- 6. Schema mismatch (server-side validation) ----------------------
  if (m.includes('incomplete ability') || m.includes('missing classname') || m.includes('schema') || m.includes('missing headercode')) {
    return {
      kind: 'schema-mismatch',
      iconName: 'FileWarning',
      title: 'The AI skipped a required field',
      plainCause: 'The generated ability is missing key pieces (class name, header, or cpp code). Try again, or rephrase the description with more detail.',
      actions: ['retry', 'edit-description'],
      rawMessage: raw,
    };
  }

  // --- 7. Client-side validation (rare from the UI, but possible) -------
  if (m.includes('missing "prompt"') || m.includes('invalid json body') || m.includes('400')) {
    return {
      kind: 'validation',
      iconName: 'AlertTriangle',
      title: 'Description is missing',
      plainCause: "We didn't have enough to send — add a description and try again.",
      actions: ['edit-description'],
      rawMessage: raw,
    };
  }

  // --- 8. Empty model response / generic upstream 5xx -------------------
  if (m.includes('empty response') || m.includes('gemini api call failed') || /\b5\d\d\b/.test(raw)) {
    return {
      kind: 'server-error',
      iconName: 'ServerCrash',
      title: 'AI service had a problem',
      plainCause: 'The AI service returned an error. Try again — if it keeps happening, try simplifying your description.',
      actions: ['retry', 'edit-description'],
      rawMessage: raw,
    };
  }

  // --- 9. Fallback ------------------------------------------------------
  return {
    kind: 'unknown',
    iconName: 'AlertTriangle',
    title: 'Something went wrong',
    plainCause: "The forge ran into an unexpected problem. Try again — the technical details below may help diagnose it.",
    actions: ['retry'],
    rawMessage: raw,
  };
}
