import mongoose from "mongoose";

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    console.log("🔄 Using existing MongoDB connection");
    return;
  }

  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI not found in environment variables");
    throw new Error("MONGO_URI not found in .env");
  }

  try {
    console.log("🌐 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
    });
    console.log("✅ MongoDB connected successfully");
  } catch (err: any) {
    console.error("❌ MongoDB connection error:", err.message);
    // On Vercel, we might want to throw or exit
    throw err;
  }
};

export default connectDB;