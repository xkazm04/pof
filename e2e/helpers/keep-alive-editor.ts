// Keep-alive editor session (pof-app §5).
//
// The vertical-slice harness launches UnrealEditor many times; each cold start
// costs tens of seconds. A `keepAlive` session launches ONE editor that stays
// alive between dispatches and runs short Python commands over the editor's
// remote-execution socket — several tests reuse the same process, so total
// wall-clock drops sharply. It also solves the MoverTests plugin-content mount
// pitfall once per session (that mount only works under the full editor).
//
// The socket transport is injectable so the lifecycle/serialization logic is
// unit-tested without launching a real editor.

const DEFAULT_UPROJECT =
  'C:\\Users\\kazda\\Documents\\Unreal Projects\\PoF\\PoF.uproject';

export type KeepAliveState = 'idle' | 'starting' | 'ready' | 'busy' | 'stopped';

/** Abstracts the editor process + its Python remote-exec channel. */
export interface EditorTransport {
  /** Launch the editor with the given argv and resolve once the channel is up. */
  start(args: string[]): Promise<void>;
  /** Send one Python command; resolve with its captured output. */
  send(command: string): Promise<string>;
  /** Terminate the editor process. */
  stop(): Promise<void>;
}

export interface KeepAliveOptions {
  uproject?: string;
  /** Map to open on launch (default the slice). */
  map?: string;
  /** Extra exec commands appended after the remote-exec bootstrap. */
  extraExecCmds?: string[];
}

/**
 * Build the launch argv for a long-lived editor with Python remote execution
 * enabled. `-ExecCmds="py ..."` boots the listener; the editor is kept windowed
 * but unattended so it survives between dispatches.
 */
export function buildKeepAliveLaunchArgs(opts: KeepAliveOptions = {}): string[] {
  const uproject = opts.uproject ?? DEFAULT_UPROJECT;
  const map = opts.map ?? '/Game/Maps/VerticalSlice';
  const exec = [
    'py import unreal; unreal.log("POF_KEEPALIVE_READY")',
    ...(opts.extraExecCmds ?? []),
  ].join(';');
  return [
    uproject,
    map,
    '-ExecutePythonScript=""',
    `-ExecCmds=${exec}`,
    '-unattended',
    '-nopause',
    '-NoLoadStartupPackages',
    '-EnablePlugins=PythonScriptPlugin',
  ];
}

/**
 * Manages one reused editor. `run()` lazily starts the editor on first use,
 * serializes commands (one at a time — the editor is single-threaded for
 * script exec), counts reuses, and never relaunches until stop() is called.
 */
export class KeepAliveEditor {
  private state: KeepAliveState = 'idle';
  private reuseCount = 0;
  private startPromise: Promise<void> | null = null;

  constructor(
    private readonly transport: EditorTransport,
    private readonly opts: KeepAliveOptions = {},
  ) {}

  getState(): KeepAliveState { return this.state; }
  getReuseCount(): number { return this.reuseCount; }

  private async ensureStarted(): Promise<void> {
    if (this.state === 'stopped') {
      throw new Error('KeepAliveEditor: session was stopped; create a new one');
    }
    if (this.state === 'ready' || this.state === 'busy') return;
    if (!this.startPromise) {
      this.state = 'starting';
      const args = buildKeepAliveLaunchArgs({
        uproject: this.opts.uproject,
        map: this.opts.map,
        extraExecCmds: this.opts.extraExecCmds,
      });
      this.startPromise = this.transport.start(args).then(() => {
        this.state = 'ready';
      });
    }
    await this.startPromise;
  }

  /**
   * Run one Python command on the reused editor, starting it if needed.
   * Commands are serialized: a call made while another is in flight waits.
   */
  async run(command: string): Promise<string> {
    await this.ensureStarted();
    // Serialize: if busy, wait until ready again.
    while (this.state === 'busy') {
      await new Promise((r) => setTimeout(r, 10));
    }
    if (this.state === 'stopped') {
      throw new Error('KeepAliveEditor: session stopped mid-run');
    }
    this.state = 'busy';
    try {
      const out = await this.transport.send(command);
      this.reuseCount += 1;
      return out;
    } finally {
      if (this.state === 'busy') this.state = 'ready';
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    this.startPromise = null;
    await this.transport.stop();
  }
}
