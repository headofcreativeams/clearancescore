import type { IncomingMessage, ServerResponse } from "node:http";
import { getLiveSignals } from "../server/live-signals";

interface VercelLikeRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
}

export default async function handler(
  req: VercelLikeRequest,
  res: ServerResponse,
) {
  try {
    const q = req.query.q;
    const query = typeof q === "string" ? q : "";
    const forceRefresh = req.query.refresh === "1";
    const result = await getLiveSignals(query, forceRefresh);
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (err) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 422;
    res.end(
      JSON.stringify({
        message: err instanceof Error ? err.message : "Failed to load live signals",
      }),
    );
  }
}
