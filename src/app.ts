// import express from "express";
// import cors from "cors";
// import apiRoutes from "./routes/index";

// import path from "path";

// const app = express();

// app.use(cors());
// app.use(express.json());

// // Register all API routes under /api
// app.use("/api", apiRoutes);

// // Serve frontend in production (Only when not on Vercel)
// const __dirname = path.resolve();
// if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
//   app.use(express.static(path.join(__dirname, "frontend/dist")));
//   app.get("*", (req, res) => {
//     res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
//   });
// } else {
//   app.get("/", (req, res) => {
//   res.json({ message: "Backend is running 🚀" });
// });
// }

// export default app;


import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import apiRoutes from "./routes/index";

const app = express();

app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", apiRoutes);

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Root
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Backend is running 🚀" });
});

// Public folder
app.use(express.static(path.join(__dirname, "public")));

// Frontend serve (non-Vercel prod)
if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  const frontendPath = path.resolve(__dirname, "../../frontend/dist");
  app.use(express.static(frontendPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.resolve(frontendPath, "index.html"));
  });
}

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Server Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

export default app;