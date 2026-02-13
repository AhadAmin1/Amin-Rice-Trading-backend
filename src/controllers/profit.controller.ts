import { Request, Response } from "express";
import Profit from "../models/Profit";

// GET /profit
export const getProfits = async (req: Request, res: Response) => {
  try {
    const profits = await Profit.find().sort({ date: -1 });
    res.json(profits);
  } catch (error) {
    res.status(500).json({ message: "Error fetching profits" });
  }
};
