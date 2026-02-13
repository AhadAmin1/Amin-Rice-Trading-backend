import dotenv from "dotenv";
dotenv.config(); 

import app from "./app";
import connectDB from "./db";

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ DB connection failed", err);
  });
