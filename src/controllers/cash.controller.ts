import { Request, Response } from "express";
import CashEntry from "../models/CashEntry";

// GET /cash
export const getCashEntries = async (req: Request, res: Response) => {
  try {
    const entries = await CashEntry.find().sort({ date: 1, createdAt: 1 });
    
    // Check if we need to recalc balances (if they are stored but might be out of sync)
    // For read-heavy, rely on stored balance. 
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching cash entries" });
  }
};

// POST /cash
export const addCashEntry = async (req: Request, res: Response) => {
  try {
    const { date, description, debit, credit, billReference } = req.body;

    const lastEntry = await CashEntry.findOne().sort({ date: -1, createdAt: -1 });
    const previousBalance = lastEntry ? lastEntry.balance : 0;
    
    const newBalance = previousBalance + (debit || 0) - (credit || 0);

    const entry = new CashEntry({
      date,
      description,
      debit: debit || 0,
      credit: credit || 0,
      balance: newBalance,
      billReference
    });

    await entry.save();
    res.status(201).json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding cash entry" });
  }
};
