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
    const { date, description, debit, credit, billReference, billId } = req.body;

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

    // Update Bill Status if billId is provided
    if (billId) {
      const Bill = require("../models/Bill").default;
      const bill = await Bill.findById(billId);
      if (bill) {
        const paymentAmount = debit || credit || 0;
        bill.paidAmount = (bill.paidAmount || 0) + paymentAmount;
        
        if (bill.paidAmount >= bill.totalAmount) {
          bill.status = 'paid';
        } else if (bill.paidAmount > 0) {
          bill.status = 'partial';
        }
        await bill.save();
      }
    }
    res.status(201).json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding cash entry" });
  }
};
// PUT /cash/:id
export const updateCashEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, description, debit, credit } = req.body;

    const entry = await CashEntry.findById(id);
    if (!entry) return res.status(404).json({ message: "Cash entry not found" });

    // Link block (optional, but good for consistency)
    if (entry.billReference && entry.billReference.startsWith("BILL-")) {
        // Maybe allow editing description only? 
        // For now let's allow it but warn or restrict if needed.
    }

    entry.date = date;
    entry.description = description;
    entry.debit = debit || 0;
    entry.credit = credit || 0;

    await entry.save();
    await recalculateCash();

    res.json({ message: "Cash entry updated", entry });
  } catch (error) {
    res.status(500).json({ message: "Error updating cash entry" });
  }
};

// DELETE /cash/:id
export const deleteCashEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const entry = await CashEntry.findById(id);
    if (!entry) return res.status(404).json({ message: "Cash entry not found" });

    await entry.deleteOne();
    await recalculateCash();

    res.json({ message: "Cash entry deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting cash entry" });
  }
};

export const recalculateCash = async () => {
  const entries = await CashEntry.find().sort({ date: 1, createdAt: 1 });
  let balance = 0;
  for (const entry of entries) {
    balance += (entry.debit || 0) - (entry.credit || 0);
    entry.balance = balance;
    await entry.save();
  }
};
