import "dotenv/config";
import { db } from "./src/database/client.js";
import { session } from "./src/database/schema.js";
import { eq } from "drizzle-orm";

try {
  const result = await db
    .select()
    .from(session)
    .limit(1);

  console.log("SESSION QUERY:", result);
} catch (error) {
  console.error("SESSION QUERY ERROR:", error);
}