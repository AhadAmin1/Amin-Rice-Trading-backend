import serverless from "serverless-http";
import app from "../src/app";
import connectDB from "../src/db";

let isConnected = false;
const handler = serverless(app);

export default async function (req: any, res: any) {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
  return handler(req, res);
}
