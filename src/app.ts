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


import express from "express";
import cors from "cors";
import apiRoutes from "./routes/index";
import path from "path";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", apiRoutes);

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Serve static files (favicon, images, etc.)
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// Root route (optional, just redirect to /api)
app.get("/", (req, res) => res.redirect("/api"));

// Serve frontend (if outside Vercel)
const frontendPath = path.resolve(__dirname, "../../frontend/dist");
if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  app.use(express.static(frontendPath));
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(frontendPath, "index.html"))
  );
}

export default app;