import type { RequestHandler } from "msw";

/**
 * Default MSW handlers. Empty on purpose in phase 0: the API has no endpoints yet,
 * and fixtures are captured from the real server rather than handwritten
 * (PLAN §4.5). Tests add per-case handlers with `server.use(...)`.
 */
export const handlers: RequestHandler[] = [];
