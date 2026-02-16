import serverless from "serverless-http";
import app from "../src/app";
import connectDB from "../src/db";
import mongoose from "mongoose";

let isConnected = false;
const handler = serverless(app);

export default async function (req: any, res: any) {
  const { method, url } = req;
  console.log(`[${method}] ${url} - Incoming request`);

  try {
    if (!isConnected || mongoose.connection.readyState === 0) {
      console.log("🛠️ Initializing database connection in Vercel handler...");
      await connectDB();
      isConnected = true;
    }
    return handler(req, res);
  } catch (err: any) {
    console.error("🔥 Critical handler error:", err.message);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      tip: "Please check MongoDB IP Whitelist (0.0.0.0/0)" 
    });
  }
}
