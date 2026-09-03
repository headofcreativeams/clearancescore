import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { storage } from "./storage";
import { getLegalFeed, getFeedSourceList } from "./legal-feed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // prefix all routes with /api
  // use storage to perform CRUD operations on the storage interface
  // e.g. app.get("/api/items", async (_req, res) => { ... })

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

  return httpServer;
}
