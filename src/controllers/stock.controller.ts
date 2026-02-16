import { Request, Response } from "express";
import Stock from "../models/Stock";
import LedgerEntry from "../models/LedgerEntry";
import Party from "../models/Party";

// GET /stock
export const getStock = async (req: Request, res: Response) => {
  try {
    const stocks = await Stock.find().sort({ createdAt: -1 });
    res.json(stocks);
  } catch (error) {
    res.status(500).json({ message: "Error fetching stock" });
  }
};

// POST /stock
export const addStock = async (req: Request, res: Response) => {
  try {
    const {
      date,
      millerId,
      millerName,
      itemName,
      katte,
      weightPerKatta,
      purchaseRate,
      rateType,
      bhardana
    } = req.body;

    const totalWeight = katte * weightPerKatta;
    const totalAmount =
      rateType === "per_kg"
        ? totalWeight * purchaseRate
        : katte * purchaseRate;

    // Total Amount should include Bhardana? 
    // User said: "miller ke khate me plus hoga". 
    // Usually Stock "Total Amount" is (Quantity * Rate) + Expense.
    // I will assume implicit addition for now, or assume the frontend passes the FINAL totalAmount?
    // Wait, the controller calculates totalAmount:
    // const totalAmount = ...
    // If I add bhardana, I should probably add it to totalAmount or keep it separate but add to ledger?
    // "bhardana alag bhi dikhe ga aur total me plus hokr total bhi dikhega"
    // So totalAmount SHOULD include bhardana.
    
    // BUT, the current code calculates totalAmount based on rate.
    // I should add bhardana to totalAmount here?
    // OR should I respect the 'totalAmount' if passed from frontend?
    // The current code ignores frontend 'totalAmount' and recalculates it.
    
    // Let's modify the calculation to include bhardana.
    const finalTotalAmount = (rateType === "per_kg"
        ? totalWeight * purchaseRate
        : katte * purchaseRate) + (Number(bhardana) || 0);

    // 1. Create Stock
    const stock = new Stock({
      date,
      millerId,
      millerName,
      itemName,
      katte,
      weightPerKatta,
      totalWeight,
      purchaseRate,
      rateType,
      totalAmount: finalTotalAmount,
      remainingKatte: katte,
      remainingWeight: totalWeight,
      bhardana: bhardana || 0
    });
    await stock.save();

    // 2. Add to Ledger (Miller Debit = Purchase/Payable Increase)
    // Fetch last balance
    const lastEntry = await LedgerEntry.findOne({ partyId: millerId }).sort({ date: -1, createdAt: -1 });
    const lastBalance = lastEntry ? lastEntry.balance : 0;
    const newBalance = lastBalance + finalTotalAmount; // Debit increases payable for Miller

    const ledgerEntry = new LedgerEntry({
      partyId: millerId,
      date,
      particulars: `Purchase: ${itemName}`,
      katte,
      weight: totalWeight,
      rate: purchaseRate,
      bhardana: bhardana || 0,
      debit: finalTotalAmount,
      credit: 0,
      balance: newBalance,
    });
    await ledgerEntry.save();

    res.status(201).json(stock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding stock" });
  }
};

// PUT /stock/:id
export const updateStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Recalculate totals if necessary
    if (updateData.katte && updateData.weightPerKatta) {
       updateData.totalWeight = updateData.katte * updateData.weightPerKatta;
    }
    
    // Note: This logic assumes we aren't changing the "Amount" in a way that needs Ledger update
    // validating complex ledger sync is hard without transactions. 
    // For now assuming simple update of stock fields.

    const stock = await Stock.findByIdAndUpdate(id, updateData, { new: true });
    res.json(stock);
  } catch (error) {
    res.status(500).json({ message: "Error updating stock" });
  }
};

// DELETE /stock/:id
export const deleteStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Stock.findByIdAndDelete(id);
    res.json({ message: "Stock deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting stock" });
  }
};
