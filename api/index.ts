// import app from "../backend/src/app";
// import connectDB from "../backend/src/db";

// // Expose the app for Vercel
// export default async (req: any, res: any) => {
//   try {
//     await connectDB();
//     // Vercel handles the request via the express app
//     return app(req, res);
//   } catch (error: any) {
//     console.error("Vercel API Error:", error);
//     res.status(500).json({
//       error: "Internal Server Error",
//       message: error.message,
//       stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
//     });
//   }
// };

// import { VercelRequest, VercelResponse } from "@vercel/node";
// import serverless from "serverless-http";
// import app from "../backend/dist/app";
// import connectDB from "../backend/dist/db";

// let isConnected = false;
// const handler = serverless(app);

// export default async function (req: VercelRequest, res: VercelResponse) {
//   try {
//     if (!isConnected) {
//       await connectDB();
//       isConnected = true;
//       console.log("Database connected ✅");
//     }
//     return handler(req, res);
//   } catch (err: any) {
//     console.error("Vercel API Error:", err.message);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
//     });
//   }
// }

import serverless from "serverless-http";
import app from "../dist/app";
import connectDB from "../dist/db";

let isConnected = false;
const handler = serverless(app);

export default async function (req: any, res: any) {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
  return handler(req, res);
}