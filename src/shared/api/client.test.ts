import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { ApiError, api, apiUrl } from "@/shared/api/client";
import { server } from "@/shared/api/msw/server";
import { DEFAULT_API_BASE } from "@/shared/config/env";

describe("apiUrl", () => {
  it("joins onto the configured base", () => {
    expect(apiUrl("/healthz")).toBe(`${DEFAULT_API_BASE}/healthz`);
    expect(apiUrl("healthz")).toBe(`${DEFAULT_API_BASE}/healthz`);
  });

  it("drops null and undefined query values and repeats arrays", () => {
    expect(apiUrl("/x", { a: 1, b: null, c: undefined, d: ["p", "q"] })).toBe(
      `${DEFAULT_API_BASE}/x?a=1&d=p&d=q`,
    );
  });
});

describe("request", () => {
  it("returns parsed JSON on success", async () => {
    server.use(http.get(`${DEFAULT_API_BASE}/__t/ok`, () => HttpResponse.json({ ok: true })));
    await expect(api.get<{ ok: boolean }>("/__t/ok")).resolves.toEqual({ ok: true });
  });

  it("normalizes FastAPI's HTTPException detail", async () => {
    server.use(
      http.get(`${DEFAULT_API_BASE}/__t/boom`, () =>
        HttpResponse.json({ detail: "profile is incomplete" }, { status: 409 }),
      ),
    );
    const error = await api.get("/__t/boom").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, detail: "profile is incomplete" });
    expect((error as ApiError).message).toBe("profile is incomplete");
  });

  it("keeps 422 validation detail as a structured array", async () => {
    const detail = [{ loc: ["query", "project"], msg: "field required", type: "missing" }];
    server.use(
      http.get(`${DEFAULT_API_BASE}/__t/invalid`, () =>
        HttpResponse.json({ detail }, { status: 422 }),
      ),
    );
    const error = (await api.get("/__t/invalid").catch((e: unknown) => e)) as ApiError;
    expect(error.isValidationError).toBe(true);
    expect(error.detail).toEqual(detail);
  });

  it("reports a network failure as status 0", async () => {
    server.use(http.get(`${DEFAULT_API_BASE}/__t/down`, () => HttpResponse.error()));
    const error = (await api.get("/__t/down").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
  });

  it("treats 204 as an empty body", async () => {
    server.use(
      http.delete(`${DEFAULT_API_BASE}/__t/gone`, () => new HttpResponse(null, { status: 204 })),
    );
    await expect(api.delete("/__t/gone")).resolves.toBeUndefined();
  });
});
