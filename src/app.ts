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

/* =====================================================
   Core Middleware
===================================================== */

app.use(
  cors({
    origin: "*", // Change to frontend domain in production
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   API Routes
===================================================== */

app.use("/api", apiRoutes);

/* =====================================================
   System Routes
===================================================== */

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Root route
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Backend is running 🚀",
  });
});

/* =====================================================
   Static Public Folder
===================================================== */

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

/* =====================================================
   Frontend Serving (Non-Vercel Production Only)
===================================================== */

if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  const frontendPath = path.resolve(__dirname, "../../frontend/dist");

  app.use(express.static(frontendPath));

  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.resolve(frontendPath, "index.html"));
  });
}

/* =====================================================
   404 Handler (Must be after all routes)
===================================================== */

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* =====================================================
   Global Error Handler
===================================================== */

app.use(
  (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error("Server Error:", err);

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error:
        process.env.NODE_ENV === "development"
          ? err.message
          : undefined,
    });
  }
);

export default app;