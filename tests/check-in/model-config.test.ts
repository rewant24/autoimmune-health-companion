/**
 * Unit tests for `lib/checkin/model-config.ts` (vendor-strategy spike
 * Track 3). The contract: `EXTRACT_MODEL_ID` env var wins when set to a
 * non-empty value; anything else falls back to the ADR-020 default.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MODEL_ID,
  getExtractModelId,
} from "@/lib/checkin/model-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getExtractModelId", () => {
  it("returns the ADR-020 default when EXTRACT_MODEL_ID is unset", () => {
    vi.stubEnv("EXTRACT_MODEL_ID", undefined as unknown as string);
    delete process.env.EXTRACT_MODEL_ID;
    expect(getExtractModelId()).toBe(DEFAULT_MODEL_ID);
  });

  it("returns the env value when set", () => {
    vi.stubEnv("EXTRACT_MODEL_ID", "google/gemini-2.5-flash");
    expect(getExtractModelId()).toBe("google/gemini-2.5-flash");
  });

  it("trims surrounding whitespace from the env value", () => {
    vi.stubEnv("EXTRACT_MODEL_ID", "  anthropic/claude-haiku-4.5  ");
    expect(getExtractModelId()).toBe("anthropic/claude-haiku-4.5");
  });

  it("falls back to the default on an empty string", () => {
    vi.stubEnv("EXTRACT_MODEL_ID", "");
    expect(getExtractModelId()).toBe(DEFAULT_MODEL_ID);
  });

  it("falls back to the default on a whitespace-only string", () => {
    vi.stubEnv("EXTRACT_MODEL_ID", "   ");
    expect(getExtractModelId()).toBe(DEFAULT_MODEL_ID);
  });

  it("resolves per call, not at import time", () => {
    vi.stubEnv("EXTRACT_MODEL_ID", "openai/gpt-4o");
    expect(getExtractModelId()).toBe("openai/gpt-4o");
    vi.stubEnv("EXTRACT_MODEL_ID", "google/gemini-2.5-flash");
    expect(getExtractModelId()).toBe("google/gemini-2.5-flash");
  });

  it("keeps the ADR-020 default id stable", () => {
    expect(DEFAULT_MODEL_ID).toBe("openai/gpt-4o-mini");
  });
});
