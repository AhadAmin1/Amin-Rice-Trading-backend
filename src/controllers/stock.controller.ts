import { Request, Response } from "express";
import Stock from "../models/Stock";
import LedgerEntry from "../models/LedgerEntry";
import Party from "../models/Party";

// GET /stock
export const getStock = async (req: Request, res: Response) => {
  try {
    const stocks = await Stock.find().sort({ createdAt: -1 });
    
    // Add fallback for missing receipt numbers for existing data
    const mappedStocks = stocks.map((s, index) => {
      const stock = s.toObject();
      if (!stock.receiptNumber) {
        // Use a virtual S- series number based on position/count if missing
        stock.receiptNumber = `S-${101 + (stocks.length - 1 - index)}`; 
      }
      return stock;
    });

    res.json(mappedStocks);
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
      bhardanaRate, // Added
      bhardana,
      receiptNumber: manualReceiptNumber,
      paymentType,
      dueDays,
      dueDate
    } = req.body;

    // Generate receipt number if not provided
    let finalReceiptNumber = manualReceiptNumber;
    if (!finalReceiptNumber) {
      const lastStock = await Stock.findOne({ receiptNumber: { $regex: /^S-/ } }).sort({ createdAt: -1 });
      if (lastStock && lastStock.receiptNumber) {
        const match = lastStock.receiptNumber.match(/\d+$/);
        if (match) {
          const nextNum = parseInt(match[0], 10) + 1;
          finalReceiptNumber = `S-${nextNum}`;
        } else {
          finalReceiptNumber = "S-101";
        }
      } else {
        const count = await Stock.countDocuments();
        finalReceiptNumber = `S-${101 + count}`;
      }
    }


    const totalWeight = katte * weightPerKatta;
    const rawAmount = rateType === "per_kg"
        ? totalWeight * purchaseRate
        : katte * purchaseRate;
    const finalTotalAmount = rawAmount + (Number(bhardana) || 0);

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
      bhardana: bhardana || 0,
      bhardanaRate: bhardanaRate || 0,
      receiptNumber: finalReceiptNumber,
      paidAmount: 0,
      status: 'unpaid',
      paymentType: paymentType || 'cash',
      dueDays: dueDays || undefined,
      dueDate: dueDate || undefined
    });
    await stock.save();

    // 2. Add to Ledger (Miller Debit = Purchase/Payable Increase)
    // Fetch last balance
    const lastEntry = await LedgerEntry.findOne({ partyId: millerId }).sort({ date: -1, createdAt: -1 });
    const lastBalance = lastEntry ? lastEntry.balance : 0;
    const newBalance = lastBalance + finalTotalAmount; // Debit increases payable for Miller

    const ledgerEntry = new LedgerEntry({
      partyId: millerId,
      stockId: stock._id,
      date,
      particulars: `Purchase: ${itemName} (${finalReceiptNumber})`,
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
    
    const existingStock = await Stock.findById(id);
    if (!existingStock) return res.status(404).json({ message: "Stock not found" });

    // 1. Recalculate Totals
    const katte = Number(updateData.katte ?? existingStock.katte);
    const weightPerKatta = Number(updateData.weightPerKatta ?? existingStock.weightPerKatta);
    const purchaseRate = Number(updateData.purchaseRate ?? existingStock.purchaseRate);
    const bhardanaRate = Number(updateData.bhardanaRate ?? existingStock.bhardanaRate);
    const rateType = updateData.rateType ?? existingStock.rateType;
    const bhardana = katte * bhardanaRate;

    const totalWeight = katte * weightPerKatta;
    const rawAmount = rateType === "per_kg"
        ? totalWeight * purchaseRate
        : katte * purchaseRate;
    const totalAmount = rawAmount + bhardana;

    // Update the record
    const updatedStock = await Stock.findByIdAndUpdate(id, {
        ...updateData,
        totalWeight,
        totalAmount,
        bhardana,
        remainingKatte: updateData.remainingKatte ?? (katte - (existingStock.katte - existingStock.remainingKatte)),
        remainingWeight: updateData.remainingWeight ?? (totalWeight - (existingStock.totalWeight - existingStock.remainingWeight)),
    }, { new: true });

    if (!updatedStock) return res.status(404).json({ message: "Update failed" });

    // 2. Sync Ledger Purchase Entry
    const ledgerEntry = await LedgerEntry.findOne({ stockId: id, credit: 0 }); 
    if (ledgerEntry) {
        ledgerEntry.date = updatedStock.date;
        ledgerEntry.particulars = `Purchase: ${updatedStock.itemName} (${updatedStock.receiptNumber})`;
        ledgerEntry.katte = updatedStock.katte;
        ledgerEntry.weight = updatedStock.totalWeight;
        ledgerEntry.rate = updatedStock.purchaseRate;
        ledgerEntry.bhardana = updatedStock.bhardana;
        ledgerEntry.debit = updatedStock.totalAmount;
        await ledgerEntry.save();
        
        const { recalculateLedger, syncStockPaidAmount } = require("./ledger.controller");
        await recalculateLedger(updatedStock.millerId.toString());
        await syncStockPaidAmount(id);
    }

    res.json(updatedStock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating stock" });
  }
};

// DELETE /stock/:id
export const deleteStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stock = await Stock.findById(id);
    if (!stock) return res.status(404).json({ message: "Stock not found" });

    const millerId = stock.millerId;

    // 1. Delete associated Ledger Entries (Purchase entry)
    // Payments linked to this stock should also be handled? 
    // Usually, we only delete the Purchase entry. Payments are separate.
    // But if we delete the stock, we must un-link or delete the purchase ledger.
    await LedgerEntry.deleteMany({ stockId: id, debit: { $gt: 0 } }); 
    
    // 2. Delete the stock itself
    await Stock.findByIdAndDelete(id);

    // 3. Recalculate miller's ledger
    const { recalculateLedger } = require("./ledger.controller");
    await recalculateLedger(millerId.toString());

    res.json({ message: "Stock deleted and ledger updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting stock" });
  }
};
