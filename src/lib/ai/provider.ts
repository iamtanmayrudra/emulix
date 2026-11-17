import { AiFailure } from "./errors";

/**
 * The model behind the AI features. Only this file knows which provider is used, so swapping it changes nothing else.
 * "text" is the cheap tier for explanations. "vision" reads a screenshot and is used for bug drafts.
 */

export type AiRequest = {
  tier: "text" | "vision";
  system: string;
  prompt: string;
  /** A screenshot to read alongside the prompt. Base64 without the data: prefix. */
  image?: { mediaType: "image/png" | "image/jpeg"; data: string };
  maxTokens: number;
};

export interface AiProvider {
  complete(request: AiRequest): Promise<string>;
}

const DEFAULT_TEXT_MODEL = "claude-haiku-5-5";
const DEFAULT_VISION_MODEL = "claude-sonnet-5-5";
const REQUEST_TIMEOUT_MS = 45_000;
const API_URL = "https://api.anthropic.com/v1/messages";

export class AnthropicProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly models = {
      text: process.env.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
      vision: process.env.AI_VISION_MODEL || DEFAULT_VISION_MODEL,
    },
  ) {}

  async complete(request: AiRequest): Promise<string> {
    const content: unknown[] = [];
    if (request.image) {
      content.push({ type: "image", source: { type: "base64", media_type: request.image.mediaType, data: request.image.data } });
    }
    content.push({ type: "text", text: request.prompt });

    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: this.models[request.tier],
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: "user", content }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new AiFailure("provider_error", "The AI service did not respond. Try again in a moment.");
    }

    if (!response.ok) {
      // The body can echo parts of the prompt, so only the status is logged.
      console.error(`[ai] provider returned ${response.status}`);
      throw new AiFailure("provider_error", "The AI service could not answer. Try again in a moment.");
    }

    const data = (await response.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
    const text = (data?.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");
    if (!text) throw new AiFailure("bad_output", "The AI service returned an empty answer. Try again.");
    return text;
  }
}

const globalForProvider = globalThis as typeof globalThis & { __emulixAiProvider?: AiProvider | null };

/** Tests install a fake provider here, and pass null to remove it. */
export function setAiProviderForTests(provider: AiProvider | null): void {
  globalForProvider.__emulixAiProvider = provider;
}

/** Throws "unavailable" when no API key is configured, so a missing key is a clear message and not a crash. */
export function getAiProvider(): AiProvider {
  if (globalForProvider.__emulixAiProvider) return globalForProvider.__emulixAiProvider;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiFailure("unavailable", "AI features are not set up on this server yet.");
  return new AnthropicProvider(apiKey);
}
