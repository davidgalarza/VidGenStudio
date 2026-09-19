import { afterEach, describe, expect, it, vi } from "vitest";
import { contentBlockMessage, isContentBlock } from "../src/lib/contentReview";
import { reviewScene } from "../src/lib/sceneRevision";
import { generateVideo, TerminalGenerationError } from "../src/lib/google";
import { DEFAULT_VIDEO, VEO_MODEL } from "../src/types";

afterEach(() => vi.unstubAllGlobals());
const response = (json: unknown, status = 200) =>
  new Response(JSON.stringify(json), { status });
const input = {
  description: "Una planta absorbe luz.",
  lockedText: "Así crecen las hojas.",
  context: "Estilo didáctico",
  referenceCount: 1,
};
const proposal = {
  kind: "clarification",
  description: "Un diagrama muestra la luz llegando a las hojas de una planta.",
  explanation: "Se concreta la acción visible en el diagrama.",
};
function mockReview(result: unknown) {
  const fetcher = vi
    .fn()
    .mockResolvedValue(response({ output_text: JSON.stringify(result) }));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
describe("content rejection classification", () => {
  it.each([
    "Request blocked due to prohibited content guidelines. Please modify your input and retry.",
    "PROHIBITED_CONTENT",
    "Safety blocked",
    "Blocked by safety filters",
    contentBlockMessage,
  ])("recognizes %s", (message) => expect(isContentBlock(message)).toBe(true));
  it.each([
    "The file failed to be processed.",
    "API key not valid",
    "Quota exceeded",
    "Google rechazó la solicitud. Revisa la clave, el prompt y las referencias.",
    "Failed to fetch",
    "Google respondió sin vídeo.",
  ])("does not offer content rewriting for %s", (message) =>
    expect(isContentBlock(message)).toBe(false),
  );
  it.each([
    [
      DEFAULT_VIDEO.model,
      {
        error: {
          message:
            "Request blocked due to prohibited content guidelines. secret-key",
        },
      },
      400,
    ],
    [
      DEFAULT_VIDEO.model,
      {
        id: "op",
        status: "completed",
        errors: [{ message: "Safety blocked" }],
      },
      200,
    ],
    [
      DEFAULT_VIDEO.model,
      {
        id: "op",
        status: "completed",
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: "PROHIBITED_CONTENT" }],
          },
        ],
      },
      200,
    ],
    [
      VEO_MODEL,
      {
        name: "operations/op",
        done: true,
        response: {
          generateVideoResponse: {
            raiMediaFilteredReasons: ["Filtered output"],
          },
        },
      },
      200,
    ],
  ] as const)(
    "makes a content rejection terminal for %s without retrying",
    async (model, body, status) => {
      const fetcher = vi.fn().mockResolvedValue(response(body, status));
      vi.stubGlobal("fetch", fetcher);
      const result = generateVideo({
        apiKey: "secret-key",
        task: {
          prompt: "Una planta",
          settings: { ...DEFAULT_VIDEO, model },
          mode: "generate",
          started_at: "now",
        },
        images: [],
        signal: new AbortController().signal,
        onProgress: vi.fn(),
        onRemoteId: vi.fn(),
      });
      const error = await result.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TerminalGenerationError);
      expect((error as Error).message).toContain(contentBlockMessage);
      expect((error as Error).message).not.toContain("secret-key");
      expect((error as Error).message).not.toContain("Revisa la clave");
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
});
describe("scene revision contract", () => {
  it("requests one text proposal with locked dialogue and no media production", async () => {
    const fetcher = mockReview(proposal);
    expect(await reviewScene("key", input)).toEqual(proposal);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toMatch(/\/interactions$/);
    const body = JSON.parse(init.body);
    expect(body.model).toBe("gemini-3.8-flash");
    expect(JSON.parse(body.input.split("SCENE_REVIEW_INPUT: ")[1])).toEqual(
      input,
    );
    expect(body.response_format.type).toBe("text");
    expect(body).not.toHaveProperty("safety_settings");
    expect(body).not.toHaveProperty("previous_interaction_id");
  });
  it("keeps substantive changes explicitly labelled as alternatives", async () => {
    mockReview({ ...proposal, kind: "alternative" });
    expect((await reviewScene("key", input)).kind).toBe("alternative");
  });
  it("never applies a manual review response, even when it contains a description", async () => {
    mockReview({ ...proposal, kind: "manual" });
    expect((await reviewScene("key", input)).description).toBe("");
  });
  it("recognizes unchanged proposals rather than encouraging identical retries", async () => {
    mockReview({ ...proposal, description: input.description });
    expect((await reviewScene("key", input)).kind).toBe("manual");
  });
  it.each([
    null,
    {},
    { ...proposal, kind: "bypass" },
    { ...proposal, description: " " },
    { ...proposal, explanation: "" },
    { ...proposal, description: "x".repeat(12001) },
  ])("rejects malformed replies", async (result) => {
    const fetcher = mockReview(result);
    await expect(reviewScene("key", input)).rejects.toThrow(
      "La escena se conserva sin cambios",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not send a request without a key or description", async () => {
    const fetcher = mockReview(proposal);
    await expect(reviewScene("", input)).rejects.toThrow("clave");
    await expect(
      reviewScene("key", { ...input, description: " " }),
    ).rejects.toThrow("descripción");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("passes cancellation through to the network request", async () => {
    const controller = new AbortController();
    const fetcher = mockReview(proposal);
    await reviewScene("key", input, controller.signal);
    const signal: AbortSignal = fetcher.mock.calls[0][1].signal;
    controller.abort();
    expect(signal.aborted).toBe(true);
  });
});
