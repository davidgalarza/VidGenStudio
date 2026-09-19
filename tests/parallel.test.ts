import { afterEach, describe, expect, it, vi } from "vitest";
import { getParallelism, saveParallelism } from "../src/lib/settings";
import {
  generateVideo,
  GoogleRateLimitError,
  TerminalGenerationError,
} from "../src/lib/google";
import { DEFAULT_VIDEO } from "../src/types";
afterEach(() => vi.unstubAllGlobals());
describe("parallel generation preferences", () => {
  it.each([null, "", "0", "-1", "99", "NaN", "1.5", "no"])(
    "uses a bounded default for %s",
    (stored) => {
      vi.stubGlobal("localStorage", { getItem: () => stored });
      expect(getParallelism()).toBe(3);
    },
  );
  it("persists a valid limit and rejects unsupported values", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key),
      setItem: (key: string, value: string) => store.set(key, value),
    });
    for (const value of [1, 2, 3, 4]) {
      saveParallelism(value);
      expect(getParallelism()).toBe(value);
    }
    for (const value of [0, 5, -1, 2.5, NaN])
      expect(() => saveParallelism(value)).toThrow();
    expect(getParallelism()).toBe(4);
  });
  it("can initialize when preference storage is inaccessible", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("Unavailable");
      },
    });
    expect(getParallelism()).toBe(3);
  });
});
it("a polling quota failure remains recoverable and never resubmits the video", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "op", status: "in_progress" })),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: "RESOURCE_EXHAUSTED" } }),
        { status: 429 },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const onRemoteId = vi.fn();
  const result = await generateVideo({
    apiKey: "test-key",
    task: {
      prompt: "A calm ocean",
      settings: DEFAULT_VIDEO,
      mode: "generate",
      started_at: "now",
    },
    images: [],
    signal: new AbortController().signal,
    onProgress: vi.fn(),
    onRemoteId,
    pollInterval: 0,
  }).catch((e: unknown) => e);
  expect(result).toBeInstanceOf(GoogleRateLimitError);
  expect(result).not.toBeInstanceOf(TerminalGenerationError);
  expect(onRemoteId).toHaveBeenCalledWith("op");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1].method).toBe("POST");
  expect(fetcher.mock.calls[1][1].method).toBeUndefined();
});
