import app from "../src/app";
import connectDB from "../src/db";
import mongoose from "mongoose";

let isConnected = false;

export default async function (req: any, res: any) {
  const { method, url } = req;
  console.log(`📡 Vercel Handler: ${method} ${url}`);

  try {
    if (!isConnected || mongoose.connection.readyState === 0) {
      console.log("🛠️ Connecting to DB...");
      await connectDB();
      isConnected = true;
    }
    
    // Vercel natively handles Express apps
    return app(req, res);
  } catch (err: any) {
    console.error("🔥 Global Handler Error:", err.message);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      check: "MongoDB IP Whitelist (0.0.0.0/0) and Vercel Environment Variables"
    });
  }
}
