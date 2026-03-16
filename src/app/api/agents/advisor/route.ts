/**
 * POST /api/agents/advisor
 *
 * Server-side Gemini advisor proxy for PoF workspace composition.
 * The client sends workspace context and user messages; the server calls
 * Gemini with function declarations and streams the response back via SSE.
 *
 * Only client-side tools (compose_workspace, suggest_action) — no server-side
 * CLI orchestration in PoF's advisor (the existing CLI system handles that).
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  POF_ADVISOR_FUNCTION_DECLARATIONS,
  POF_ADVISOR_SYSTEM_INSTRUCTION,
} from '@/lib/dzin/advisor/advisorTools';

/* ── Types ────────────────────────────────────────────────────────────── */

interface AdvisorRequest {
  workspace: {
    panels: Array<{ type: string; role: string }>;
    layout: string;
  };
  userMessage?: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
}

/* ── Tool classification ──────────────────────────────────────────────── */

const CLIENT_SIDE_TOOLS = new Set(['compose_workspace', 'suggest_action']);
const MAX_ORCHESTRATOR_TURNS = 4;

/* ── Gemini client singleton ──────────────────────────────────────────── */

let cachedClient: InstanceType<typeof GoogleGenAI> | null = null;

function getClient(): InstanceType<typeof GoogleGenAI> | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

/* ── POST handler (SSE streaming) ─────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { success: false, error: 'Gemini API key not configured. Set GEMINI_API_KEY in .env.local.' },
      { status: 503 },
    );
  }

  let body: AdvisorRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // Build user prompt from workspace context
  const promptParts: string[] = [];
  const panels = body.workspace.panels.map(p => `${p.type}(${p.role})`).join(', ');
  promptParts.push(`[Current Workspace] Layout: ${body.workspace.layout}, Panels: ${panels || 'empty'}`);

  if (body.userMessage) {
    promptParts.push('');
    promptParts.push(`[User Message] ${body.userMessage}`);
  }

  // Build contents with conversation history
  type ContentPart =
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: Record<string, unknown> } };
  type ContentMessage = { role: 'user' | 'model'; parts: ContentPart[] };

  const contents: ContentMessage[] = [];
  if (body.history?.length) {
    for (const msg of body.history.slice(-6)) {
      contents.push({ role: msg.role, parts: [{ text: msg.text }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: promptParts.join('\n') }] });

  // SSE streaming response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  function writeSSE(event: { type: string; [key: string]: unknown }): void {
    const line = JSON.stringify(event) + '\n';
    writer.write(encoder.encode(line)).catch(() => {});
  }

  (async () => {
    try {
      let turns = 0;

      while (turns < MAX_ORCHESTRATOR_TURNS) {
        turns++;
        writeSSE({
          type: 'status',
          status: turns === 1 ? 'Thinking...' : `Processing (turn ${turns})...`,
          turn: turns,
        });

        const response = await client.models.generateContent({
          model: 'gemini-2.0-flash',
          contents,
          config: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            systemInstruction: POF_ADVISOR_SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: POF_ADVISOR_FUNCTION_DECLARATIONS }],
          },
        });

        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts) break;

        let hasServerTools = false;

        for (const part of candidate.content.parts) {
          if (part.text) {
            writeSSE({ type: 'text', text: part.text, turn: turns });
          }
          if (part.functionCall && part.functionCall.name) {
            const callName = part.functionCall.name;
            const callArgs = (part.functionCall.args ?? {}) as Record<string, unknown>;

            if (CLIENT_SIDE_TOOLS.has(callName)) {
              writeSSE({
                type: 'tool_call',
                toolCall: { name: callName, args: callArgs },
                turn: turns,
              });
            }
            // PoF advisor has no server-side tools, so this loop always breaks
          }
        }

        // No server-side tools in PoF — always done after first Gemini response
        if (!hasServerTools) break;
      }

      writeSSE({ type: 'done' });
    } catch (error) {
      writeSSE({
        type: 'error',
        error: error instanceof Error ? error.message : 'Gemini API call failed',
      });
    } finally {
      writer.close().catch(() => {});
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/* ── GET — health check ───────────────────────────────────────────────── */

export async function GET() {
  const client = getClient();
  return NextResponse.json({ available: !!client, service: 'pof-gemini-advisor' });
}
