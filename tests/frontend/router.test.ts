import { describe, it, expect, vi, beforeEach } from "vitest";
import { routeUserInput } from "../../src/lib/signalscope/router";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("routeUserInput", () => {
  it("routes analyze momentum", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ action: "analyze_signal", source: "momentum" }),
      })
    );

    const result = await routeUserInput("analyze momentum signal");

    expect(result.action).toBe("analyze_signal");
    expect(result.source).toBe("momentum");
  });

  it("falls back on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const result = await routeUserInput("analyze momentum signal");

    expect(result.action).toBe("analyze_signal");
    expect(result.source).toBe("momentum");
  });

  it("routes explain_last_result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ action: "explain_last_result" }),
      })
    );

    const result = await routeUserInput("explain this");

    expect(result.action).toBe("explain_last_result");
  });
});
