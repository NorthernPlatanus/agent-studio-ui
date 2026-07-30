import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** Node-side MSW server shared by every Vitest run; started in `vitest.setup.ts`. */
export const server = setupServer(...handlers);
