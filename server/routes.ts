import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { getLegalFeed, getFeedSourceList } from "./legal-feed";
import { getLiveSignals } from "./live-signals";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // prefix all routes with /api

  // Persistent legal-updates feed: aggregates real, live RSS sources (Google News
  // search feeds + IPWatchdog) server-side, cached for 15 minutes per instance.
  app.get("/api/legal-feed", async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === "1";
      const feed = await getLegalFeed(forceRefresh);
      res.json({
        items: feed.items,
        fetchedAt: feed.fetchedAt,
        errors: feed.errors,
        sources: getFeedSourceList(),
      });
    } catch (err) {
      res.status(422).json({ message: err instanceof Error ? err.message : "Failed to load legal feed" });
    }
  });

  // Live, real-time lookup scoped to a specific scan's generative model / keyword.
  // Hits CourtListener (real case law, no API key) + Google News RSS. This is a raw
  // search layer for human review, not a detection engine, and does not feed the
  // illustrative 0-100 score.
  app.get("/api/live-signals", async (req, res) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const forceRefresh = req.query.refresh === "1";
      const result = await getLiveSignals(query, forceRefresh);
      res.json(result);
    } catch (err) {
      res.status(422).json({ message: err instanceof Error ? err.message : "Failed to load live signals" });
    }
  });

  return httpServer;
}
