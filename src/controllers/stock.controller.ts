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
    } = req.body;

    const totalWeight = katte * weightPerKatta;
    const totalAmount =
      rateType === "per_kg"
        ? totalWeight * purchaseRate
        : katte * purchaseRate;

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
      totalAmount,
      remainingKatte: katte,
      remainingWeight: totalWeight,
    });
    await stock.save();

    // 2. Add to Ledger (Miller Debit = Purchase/Payable Increase)
    // Fetch last balance
    const lastEntry = await LedgerEntry.findOne({ partyId: millerId }).sort({ date: -1, createdAt: -1 });
    const lastBalance = lastEntry ? lastEntry.balance : 0;
    const newBalance = lastBalance + totalAmount; // Debit increases payable for Miller

    const ledgerEntry = new LedgerEntry({
      partyId: millerId,
      date,
      particulars: `Purchase: ${itemName}`,
      katte,
      weight: totalWeight,
      rate: purchaseRate,
      debit: totalAmount,
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
