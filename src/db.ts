import { drizzle } from "drizzle-orm/bun-sql";

import { requireEnv } from "./env";
import * as schema from "./schema";

export const db = drizzle(requireEnv("DATABASE_URL"), { schema });
