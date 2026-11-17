export type AiErrorCode =
  | "invalid_input"
  | "quota_exceeded"
  | "unavailable"
  | "provider_error"
  | "bad_output";

export class AiFailure extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const AI_STATUS_BY_CODE: Record<AiErrorCode, number> = {
  invalid_input: 400,
  quota_exceeded: 429,
  unavailable: 503,
  provider_error: 502,
  bad_output: 502,
};
