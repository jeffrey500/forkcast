/** An error whose message is safe to show to the user. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * The deployment is missing a setting. The message names the setting to fix,
 * never data or secret values, so it's safe to show even in production.
 */
export class SetupError extends HttpError {
  constructor(message: string) {
    super(503, `Setup needed: ${message}`);
  }
}
