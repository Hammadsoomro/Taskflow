import "dotenv/config";
import express from "express";
import cors, { CorsOptions } from "cors";
import { handleDemo } from "./routes/demo";
import { handleLogin, handleSignup } from "./routes/auth";
import { addToQueue, getQueuedLines, clearQueuedLine, clearAllQueuedLines, deduplicateLines } from "./routes/queued";
import { addToHistory, getHistory, searchHistory } from "./routes/history";
import { createTeamMember, getTeamMembers, deleteTeamMember } from "./routes/members";
import {
  uploadProfilePicture,
  getProfile,
  updateName,
  changePassword,
  resetAccount,
} from "./routes/profile";
import {
  getClaimSettings,
  updateClaimSettings,
  claimNumbers,
  getClaimedNumbers,
  releaseClaimedNumbers,
} from "./routes/claim";
import { connectDB } from "./db";
import { authMiddleware } from "./middleware/auth";
import { getCollections } from "./db";

export async function createServer() {
  console.log("[Server] Starting server initialization...");
  // Initialize MongoDB connection
  try {
    await connectDB();
    console.log("[Server] Database initialized successfully");
  } catch (error) {
    console.error("[Server] Failed to initialize database:", error);
    // Continue even if database fails, but endpoints will return 500
  }

  const app = express();

  // Middleware
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // In a serverless environment or local dev, reflect the origin back
      // If no origin (same-site or non-browser), allow it.
      if (!origin) {
        callback(null, true);
        return;
      }
      // For cross-site, reflect the origin
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));

  // Request logger
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.path}`);
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Health check endpoint (no auth required)
  app.get("/api/health", (_req, res) => {
    try {
      getCollections();
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      res.status(503).json({
        status: "error",
        database: "disconnected",
        error: String(error),
      });
    }
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Authentication routes
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/signup", handleSignup);

  // Queued list routes (protected)
  app.post("/api/queued/add", authMiddleware as unknown as express.RequestHandler, addToQueue);
  app.get("/api/queued", authMiddleware as unknown as express.RequestHandler, getQueuedLines);
  app.delete("/api/queued", authMiddleware as unknown as express.RequestHandler, clearAllQueuedLines);
  app.delete("/api/queued/:lineId", authMiddleware as unknown as express.RequestHandler, clearQueuedLine);
  app.post("/api/queued/deduplicate", authMiddleware as unknown as express.RequestHandler, deduplicateLines);

  // History routes (protected)
  app.post("/api/history/add", authMiddleware as unknown as express.RequestHandler, addToHistory);
  app.get("/api/history", authMiddleware as unknown as express.RequestHandler, getHistory);
  app.get("/api/history/search", authMiddleware as unknown as express.RequestHandler, searchHistory);

  // Member routes (protected)
  app.get("/api/members", authMiddleware as unknown as express.RequestHandler, getTeamMembers);
  app.post("/api/members", authMiddleware as unknown as express.RequestHandler, createTeamMember);
  app.delete("/api/members/:memberId", authMiddleware as unknown as express.RequestHandler, deleteTeamMember);

  // Profile routes (protected)
  app.get("/api/profile", authMiddleware as unknown as express.RequestHandler, getProfile);
  app.post("/api/profile/upload-picture", authMiddleware as unknown as express.RequestHandler, uploadProfilePicture);
  app.post("/api/profile/update-name", authMiddleware as unknown as express.RequestHandler, updateName);
  app.post("/api/profile/change-password", authMiddleware as unknown as express.RequestHandler, changePassword);
  app.post("/api/profile/reset-account", authMiddleware as unknown as express.RequestHandler, resetAccount);

  // Claim routes (protected)
  app.get("/api/claim/settings", authMiddleware as unknown as express.RequestHandler, getClaimSettings);
  app.put("/api/claim/settings", authMiddleware as unknown as express.RequestHandler, updateClaimSettings);
  app.post("/api/claim", authMiddleware as unknown as express.RequestHandler, claimNumbers);
  app.get("/api/claim/numbers", authMiddleware as unknown as express.RequestHandler, getClaimedNumbers);
  app.post("/api/claim/release", authMiddleware as unknown as express.RequestHandler, releaseClaimedNumbers);

  // Global error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("[Server] Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  });

  return app;
}
