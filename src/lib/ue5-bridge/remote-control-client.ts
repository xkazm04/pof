/**
 * UE5 Remote Control HTTP Client
 *
 * Communicates with UE5's Web Remote Control plugin over HTTP.
 * All methods return Result<T, string> for explicit success/failure handling.
 *
 * UE5 Remote Control API reference:
 *   GET  /remote/info              — server info & version
 *   PUT  /remote/object/property   — read/write object properties
 *   PUT  /remote/object/call       — invoke UFUNCTIONs
 *   PUT  /remote/object/describe   — describe an object's properties
 *   PUT  /remote/search/assets     — search project assets
 *   PUT  /remote/batch             — batch multiple requests
 */

import { ok, err, type Result } from '@/types/result';
import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import type {
  UE5RemoteControlInfo,
  UE5FunctionCall,
  UE5AssetSearchResult,
  UE5BatchRequest,
  UE5BatchResponse,
} from '@/types/ue5-bridge';

// ── Client ──────────────────────────────────────────────────────────────────

export class RemoteControlClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(host: string, httpPort: number) {
    this.baseUrl = `http://${host}:${httpPort}`;
    this.timeout = UI_TIMEOUTS.ue5HttpTimeout;
  }

  // ── Core HTTP helper ──────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<Result<T, string>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const init: RequestInit = {
        method,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      };

      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      const res = await fetch(url, init);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const msg = `UE5 Remote Control ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`;
        logger.warn('[UE5-RC]', msg);
        return err(msg);
      }

      const data = (await res.json()) as T;
      return ok(data);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        const msg = `UE5 Remote Control ${method} ${path} timed out after ${this.timeout}ms`;
        logger.warn('[UE5-RC]', msg);
        return err(msg);
      }
      const msg = e instanceof Error ? e.message : 'Unknown fetch error';
      logger.warn('[UE5-RC]', `${method} ${path} failed:`, msg);
      return err(msg);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Ping the Remote Control server and return version info. */
  async ping(): Promise<Result<UE5RemoteControlInfo, string>> {
    return this.request<UE5RemoteControlInfo>('GET', '/remote/info');
  }

  /** Read a property value from a UObject. */
  async getProperty(objectPath: string, propertyName: string): Promise<Result<unknown, string>> {
    return this.request<unknown>('PUT', '/remote/object/property', {
      objectPath,
      access: 'READ_ACCESS',
      propertyName,
    });
  }

  /** Write a property value on a UObject. */
  async setProperty(
    objectPath: string,
    propertyName: string,
    value: unknown,
  ): Promise<Result<unknown, string>> {
    return this.request<unknown>('PUT', '/remote/object/property', {
      objectPath,
      access: 'WRITE_ACCESS',
      propertyName,
      propertyValue: { [propertyName]: value },
    });
  }

  /** Call a UFUNCTION on a UObject. */
  async callFunction(call: UE5FunctionCall): Promise<Result<unknown, string>> {
    return this.request<unknown>('PUT', '/remote/object/call', {
      objectPath: call.objectPath,
      functionName: call.functionName,
      parameters: call.parameters ?? {},
      generateTransaction: true,
    });
  }

  /** Search project assets by query string and optional class filter. */
  async searchAssets(
    query: string,
    className?: string,
  ): Promise<Result<UE5AssetSearchResult[], string>> {
    const body: Record<string, unknown> = { query };
    if (className) {
      body.filter = { classNames: [className] };
    }

    const result = await this.request<{ assets?: UE5AssetSearchResult[] }>(
      'PUT',
      '/remote/search/assets',
      body,
    );

    if (!result.ok) return result;
    return ok(result.data.assets ?? []);
  }

  /** Describe a UObject's exposed properties and functions. */
  async describeObject(objectPath: string): Promise<Result<unknown, string>> {
    return this.request<unknown>('PUT', '/remote/object/describe', {
      objectPath,
    });
  }

  /** Execute a batch of Remote Control requests. */
  async batch(batchRequest: UE5BatchRequest): Promise<Result<UE5BatchResponse, string>> {
    return this.request<UE5BatchResponse>('PUT', '/remote/batch', batchRequest);
  }
}
