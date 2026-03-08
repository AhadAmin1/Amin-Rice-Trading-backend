import { Request, Response } from "express";
import Bill from "../models/Bill";
import LedgerEntry from "../models/LedgerEntry";
import Stock from "../models/Stock";
import CashEntry from "../models/CashEntry";
import Profit from "../models/Profit";

// Recalculate ledger balance for a party
const recalculateLedger = async (partyId: string) => {
  const entries = await LedgerEntry.find({ partyId }).sort({ date: 1, createdAt: 1 });
  let balance = 0;

  for (const e of entries) {
    balance = balance + (e.debit || 0) - (e.credit || 0);
    e.balance = balance;
    await e.save();
  }
};

// Helper to get next bill number
export const getNextBillId = async () => {
  const lastBill = await Bill.findOne({ billNumber: { $regex: /^B-/ } }).sort({ createdAt: -1 });
  if (lastBill && lastBill.billNumber) {
    const match = lastBill.billNumber.match(/\d+$/);
    if (match) {
      const nextNum = parseInt(match[0], 10) + 1;
      return `B-${nextNum}`;
    }
  }
  const count = await Bill.countDocuments();
  return `B-${101 + count}`;
};

// GET /bills/next-number
export const getNextBillNumber = async (req: Request, res: Response) => {
  try {
    const nextNumber = await getNextBillId();
    res.json({ nextNumber });
  } catch (error) {
    res.status(500).json({ message: "Error fetching next bill number" });
  }
};

// POST /bills
export const createBill = async (req: Request, res: Response) => {
  console.log("📝 Controller: createBill started", req.body);
  try {
    const { 
      buyerId, 
      millerId, 
      date, 
      billNo, 
      katte, 
      weight, 
      rate, 
      totalAmount,
      buyerName,
      millerName,
      itemName,
      stockId,
      purchaseCost,
      weightGainProfit,
      profit,
      rateType,
      bhardana,
      minusWeight,
      paymentType,
      dueDays,
      dueDate
    } = req.body;

    // 1️⃣ Validate Stock
    const stockItem = await Stock.findById(stockId);
    
    if (!stockItem) {
      return res.status(404).json({ message: "Stock item not found" });
    }

    if (stockItem.remainingKatte < katte) {
      return res.status(400).json({ 
        message: `Insufficient stock quantity. Available: ${stockItem.remainingKatte}, Requested: ${katte}` 
      });
    }

    // 2️⃣ Generate Bill Number if not provided
    let finalBillNo = billNo;
    if (!finalBillNo) {
      finalBillNo = await getNextBillId();
    }

    // 3️⃣ Create Bill Record
    const bill = new Bill({
      buyerId,
      millerId,
      date,
      billNumber: finalBillNo,
      billNo: finalBillNo,
      buyerName,
      millerName,
      itemName,
      katte,
      weight,
      rate,
      totalAmount,
      stockId,
      purchaseCost,
      profit,
      rateType,
      bhardana: bhardana || 0,
      minusWeight: minusWeight || 0,
      paymentType: paymentType || 'cash',
      dueDays: dueDays || undefined,
      dueDate: dueDate || undefined
    });
    await bill.save();

    // 4️⃣ Add Cash Entry (Sales Revenue)
    // Add Cash Entry
    const lastCash = await CashEntry.findOne().sort({ date: -1, createdAt: -1 });
    const cashBalance = lastCash ? lastCash.balance : 0;
    
    const cashEntry = new CashEntry({
      date,
      description: `Sale to ${buyerName} - ${itemName}`,
      billReference: finalBillNo,
      debit: totalAmount,
      credit: 0,
      balance: cashBalance + totalAmount
    });
    await cashEntry.save();

    // 5️⃣ Update Buyer Ledger (They owe us)
    const lastBuyer = await LedgerEntry.findOne({ partyId: buyerId }).sort({ date: -1, createdAt: -1 });
    const buyerBalance = lastBuyer ? lastBuyer.balance : 0;

    const buyerLedger = new LedgerEntry({
      partyId: buyerId,
      billId: bill._id, // link to bill
      date,
      particulars: `Sale: ${itemName} - Bill ${finalBillNo}`,
      billNo: finalBillNo,
      katte,
      weight,
      rate,
      bhardana: bhardana || 0,
      debit: totalAmount,
      credit: 0,
      balance: buyerBalance + totalAmount // Balance increases
    });
    await buyerLedger.save();

    // 6️⃣ Add Profit Entry
    const profitEntry = new Profit({
      billId: bill._id,
      billNumber: finalBillNo,
      date,
      buyerId,
      buyerName,
      itemName,
      katte,
      totalWeight: weight,
      sellingAmount: totalAmount,
      purchaseCost,
      weightGainProfit: weightGainProfit || 0,
      profit
    });
    await profitEntry.save();

    // 7️⃣ Reduce Stock Only AFTER successful saves
    stockItem.remainingKatte -= katte;
    stockItem.remainingWeight -= weight;
    await stockItem.save();

    console.log("✅ Controller: createBill success", bill._id);
    res.status(201).json({ 
      bill, 
      stock: stockItem,
      cashEntry,
      buyerLedger,
      profitEntry 
    });

  } catch (error: any) {
    console.error("❌ Controller: createBill error:", error.message);
    res.status(500).json({ message: "Error creating bill", error: error.message });
  }
};

// GET /bills
export const getBills = async (req: Request, res: Response) => {
  console.log("🔍 Controller: getBills started");
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    console.log(`✅ Controller: getBills success - Found ${bills.length} bills`);
    res.json(bills);
  } catch (error: any) {
    console.error("❌ Controller: getBills error:", error.message);
    res.status(500).json({ message: "Error fetching bills", error: error.message });
  }
};

// DELETE /bills/:id
export const deleteBill = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bill = await Bill.findById(id);
    
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    
    // 2. Delete Ledger Entries linked to this bill
    await LedgerEntry.deleteMany({ billId: id });
    await recalculateLedger(bill.buyerId.toString());

    // 3. Delete Profit Entry
    await Profit.deleteMany({ billId: id });

    // 4. Delete Cash Entry
    await CashEntry.findOneAndDelete({ billReference: bill.billNumber });

    // 5. Restore Stock
    if (bill.stockId) {
      const stock = await Stock.findById(bill.stockId);
      if (stock) {
          stock.remainingKatte += bill.katte;
          stock.remainingWeight += bill.weight;
          await stock.save();
      }
    }

    await Bill.findByIdAndDelete(id);

    res.json({ message: "Bill deleted and stock restored" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting bill" });
  }
};

// PUT /bills/:id
export const updateBill = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      date, 
      buyerId, 
      millerId, 
      katte, 
      weight, 
      rate, 
      totalAmount,
      rateType,
      billNo,
      billNumber
    } = req.body;

    const actualBillNumber = billNo || billNumber;

    const bill = await Bill.findById(id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    // 1️⃣ Restore Old Stock Levels
    if (bill.stockId) {
        const oldStock = await Stock.findById(bill.stockId);
        if (oldStock) {
            oldStock.remainingKatte += bill.katte;
            oldStock.remainingWeight += bill.weight;
            await oldStock.save();
        }
    }

    // Simplistic Update
    bill.date = date;
    bill.buyerId = buyerId;
    bill.millerId = millerId;
    bill.katte = katte;
    bill.weight = weight;
    bill.rate = rate;
    bill.rateType = rateType;
    bill.totalAmount = totalAmount;
    
    // Update string names
    if (req.body.buyerName) bill.buyerName = req.body.buyerName;
    if (req.body.millerName) bill.millerName = req.body.millerName;
    if (req.body.itemName) bill.itemName = req.body.itemName;
    if (req.body.stockId) bill.stockId = req.body.stockId;
    
    if (actualBillNumber) {
        bill.billNumber = actualBillNumber; 
        bill.billNo = actualBillNumber;
    }
    bill.paymentType = req.body.paymentType || bill.paymentType;
    bill.dueDays = req.body.dueDays || bill.dueDays;
    bill.dueDate = req.body.dueDate || bill.dueDate;
    if (req.body.purchaseCost !== undefined) bill.purchaseCost = req.body.purchaseCost;
    if (req.body.profit !== undefined) bill.profit = req.body.profit;
    if (req.body.bhardana !== undefined) bill.bhardana = req.body.bhardana;
    if (req.body.minusWeight !== undefined) bill.minusWeight = req.body.minusWeight;

    await bill.save();

    // 2️⃣ Deduct New Stock Levels
    if (bill.stockId) {
        const newStock = await Stock.findById(bill.stockId);
        if (newStock) {
            newStock.remainingKatte -= katte;
            newStock.remainingWeight -= weight;
            await newStock.save();
        }
    }

    // 2️⃣ Update ledger entries
    const buyerLedger = await LedgerEntry.findOne({ billId: bill._id, partyId: buyerId });
    if (buyerLedger) {
        buyerLedger.date = date;
        buyerLedger.debit = totalAmount;
        buyerLedger.credit = 0;
        buyerLedger.katte = katte;
        buyerLedger.weight = weight;
        buyerLedger.rate = rate;
        if (actualBillNumber) buyerLedger.billNo = actualBillNumber;
        buyerLedger.bhardana = req.body.bhardana || 0;
        await buyerLedger.save();
    }
    await recalculateLedger(buyerId);

    // 3️⃣ Update Cash Entry
    const { recalculateCash } = require("./cash.controller");
    const cashEntry = await CashEntry.findOne({ billReference: bill.billNumber });
    if (cashEntry) {
        cashEntry.date = date;
        cashEntry.debit = totalAmount;
        cashEntry.description = `Sale to ${bill.buyerName} - ${bill.itemName}`;
        await cashEntry.save();
        await recalculateCash();
    }

    // 4️⃣ Update Profit Entry
    const profitEntry = await Profit.findOne({ billId: bill._id });
    if (profitEntry) {
        profitEntry.date = date;
        profitEntry.sellingAmount = totalAmount;
        profitEntry.purchaseCost = req.body.purchaseCost || profitEntry.purchaseCost;
        profitEntry.weightGainProfit = req.body.weightGainProfit !== undefined ? req.body.weightGainProfit : profitEntry.weightGainProfit;
        profitEntry.profit = req.body.profit || (totalAmount - profitEntry.purchaseCost);
        await profitEntry.save();
    }

    // 5️⃣ Re-sync bill paid amount and status (in case totalAmount changed)
    const { syncBillPaidAmount } = require("./ledger.controller");
    await syncBillPaidAmount(bill._id.toString());

    // Return the fresh version after status sync
    const freshBill = await Bill.findById(bill._id);
    res.json(freshBill);
  } catch (error: any) {
    console.error("❌ updateBill Error:", error);
    res.status(500).json({ message: "Error updating bill", error: error.message });
  }
};