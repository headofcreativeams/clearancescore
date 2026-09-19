import type { IncomingMessage, ServerResponse } from "node:http";
import { getLegalFeed, getFeedSourceList } from "../server/legal-feed";

interface VercelLikeRequest extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
}

export default async function handler(
  req: VercelLikeRequest,
  res: ServerResponse,
) {
  try {
    const forceRefresh = req.query.refresh === "1";
    const feed = await getLegalFeed(forceRefresh);
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        items: feed.items,
        fetchedAt: feed.fetchedAt,
        errors: feed.errors,
        sources: getFeedSourceList(),
      }),
    );
  } catch (err) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 422;
    res.end(
      JSON.stringify({
        message: err instanceof Error ? err.message : "Failed to load legal feed",
      }),
    );
  }
}
