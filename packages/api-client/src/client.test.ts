import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";

describe("createApiClient", () => {
  it("makes a correctly-typed request against a path from the generated schema", async () => {
    const mockFetch = vi.fn(async () =>
      Response.json({ status: "ok", database: "ok" }, { status: 200 }),
    );
    const client = createApiClient("http://localhost:3001", { fetch: mockFetch });

    const { data, error } = await client.GET("/v1/health");

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(error).toBeUndefined();
    expect(data).toEqual({ status: "ok", database: "ok" });
  });
});
