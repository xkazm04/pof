/**
 * A provider cannot run because its credential is not configured. The route maps this
 * to 503 ("not configured") rather than 502 ("provider failed"); classification keys on
 * this type, never on the message text, so rewording the message cannot change the status.
 */
export class ProviderNotConfiguredError extends Error {
  readonly code = 'PROVIDER_NOT_CONFIGURED';

  constructor(message: string) {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}
