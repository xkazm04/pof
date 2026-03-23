/**
 * POST /api/agents/live-token
 *
 * Generates an ephemeral token for the Gemini Live API.
 * The real API key stays server-side; the client gets a
 * short-lived token locked to audio mode with the advisor's
 * system instruction and tools.
 */

import { NextRequest } from 'next/server';
import { GoogleGenAI, Modality, Type, type FunctionDeclaration } from '@google/genai';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

// ─── PoF-specific voice function declarations (mirrors advisorTools.ts) ──

const VOICE_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'compose_workspace',
    description:
      'Rearrange workspace panels for UE5 ARPG combat development. ' +
      'Composition patterns: debug effects -> effects + effect-timeline + damage-calc (grid-4). ' +
      'Ability authoring -> core + abilities + tags (studio). ' +
      'Tag audit -> tags + tag-deps + tag-audit (split-3). ' +
      'Balance tuning -> abilities + attributes + loadout + damage-calc (grid-4).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: 'show: add panels. hide: remove panels. replace: clear and set new. clear: remove all.',
          enum: ['show', 'hide', 'replace', 'clear'],
        },
        layout: {
          type: Type.STRING,
          description: 'Optional layout preset.',
          enum: ['stack', 'single', 'split-2', 'split-3', 'grid-4', 'primary-sidebar', 'triptych', 'studio'],
        },
        panels: {
          type: Type.STRING,
          description:
            'JSON array of panel objects: [{"type":"panel-type","role":"primary|secondary|sidebar"}]. ' +
            'Panel types: arpg-combat-core, arpg-combat-attributes, arpg-combat-tags, arpg-combat-abilities, ' +
            'arpg-combat-effects, arpg-combat-effect-timeline, arpg-combat-damage-calc, ' +
            'arpg-combat-tag-deps, arpg-combat-tag-audit, arpg-combat-loadout',
        },
        reasoning: {
          type: Type.STRING,
          description: 'Brief explanation of why these panels were chosen.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'suggest_action',
    description: 'Send a proactive suggestion to the user as a dismissible card.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: {
          type: Type.STRING,
          description: 'The suggestion text (1-3 sentences).',
        },
        compose_on_accept: {
          type: Type.STRING,
          description: 'Optional JSON for a compose_workspace call if user accepts.',
        },
      },
      required: ['content'],
    },
  },
];

const VOICE_SYSTEM_INSTRUCTION = `You are the Voice Advisor for Pillars of Fortune (PoF), an AI-powered UE5 C++ ARPG game development assistant.

## Available Actions
- Use compose_workspace to show relevant panels based on what the developer is working on
- Use suggest_action for proactive suggestions

## Panel Mapping
- Debug effects/damage: effects + effect-timeline + damage-calc (grid-4)
- Ability overview: core + abilities (split-2)
- Comprehensive authoring: tags + core + attributes + abilities (studio)
- Tag quality audit: tags + tag-deps + tag-audit (split-3)
- Balance tuning: abilities + attributes + loadout + damage-calc (grid-4)
- GAS pipeline focus: core (primary) + effects (sidebar, compact)

## Voice Conversation Rules
- Keep responses short and conversational (1-3 sentences max)
- Be proactive — suggest workspace layouts based on what the developer describes
- When the developer mentions a task, compose the workspace immediately
- Use natural, friendly tone
- Reference UE5/GAS concepts when relevant`;

// ─── Voices ──────────────────────────────────────

const VALID_VOICES = ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'] as const;
type VoiceName = typeof VALID_VOICES[number];

// ─── Route ───────────────────────────────────────

let cachedClient: InstanceType<typeof GoogleGenAI> | null = null;

function getClient(): InstanceType<typeof GoogleGenAI> | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;
  cachedClient = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
  return cachedClient;
}

export async function POST(request: NextRequest) {
  const client = getClient();
  if (!client) {
    return apiError('Gemini API key not configured. Set GEMINI_API_KEY in .env.local.', 503);
  }

  let voice: VoiceName = 'Puck';
  try {
    const body = await request.json();
    if (body.voice && VALID_VOICES.includes(body.voice)) {
      voice = body.voice;
    }
  } catch {
    // Default voice if no body
  }

  try {
    const expireAtIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const token = await client.authTokens.create({
      config: {
        uses: 20,
        expireTime: expireAtIso,
        newSessionExpireTime: expireAtIso,
        httpOptions: { apiVersion: 'v1alpha' },
        liveConnectConstraints: {
          model: 'gemini-2.0-flash-live-001',
          config: {
            responseModalities: [Modality.AUDIO, Modality.TEXT],
            systemInstruction: VOICE_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: VOICE_FUNCTION_DECLARATIONS }],
            inputAudioTranscription: {},
            temperature: 0.7,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice,
                },
              },
            },
          },
        },
      },
    });

    return apiSuccess({
      token: token.name,
      voice,
      model: 'gemini-2.0-flash-live-001',
      expiresIn: 30 * 60, // seconds
      expiresAt: expireAtIso,
    });
  } catch (error) {
    logger.error('[live-token] Token creation failed:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to create ephemeral token',
      502,
    );
  }
}

/** GET — health check */
export async function GET() {
  const client = getClient();
  return apiSuccess({
    available: !!client,
    service: 'gemini-live-token',
    voices: VALID_VOICES,
  });
}
