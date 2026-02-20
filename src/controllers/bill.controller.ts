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
      profit,
      rateType,
      bhardana
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
      const lastBill = await Bill.findOne().sort({ createdAt: -1 });
      if (lastBill && !isNaN(Number(lastBill.billNumber))) {
        finalBillNo = (Number(lastBill.billNumber) + 1).toString();
      } else {
        const count = await Bill.countDocuments();
        finalBillNo = (1001 + count).toString();
      }
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
      bhardana: bhardana || 0
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
      billNo 
    } = req.body;

    const bill = await Bill.findById(id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    // Simplistic Update
    bill.date = date;
    bill.buyerId = buyerId;
    bill.millerId = millerId;
    bill.katte = katte;
    bill.weight = weight;
    bill.rate = rate;
    bill.rateType = rateType;
    bill.totalAmount = totalAmount;
    bill.billNumber = billNo; 

    await bill.save();

    // 2️⃣ Update ledger entries
    const buyerLedger = await LedgerEntry.findOne({ billId: bill._id, partyId: buyerId });
    if (buyerLedger) {
        buyerLedger.date = date;
        buyerLedger.debit = totalAmount; // Update debit for sales
        buyerLedger.credit = 0;
        buyerLedger.katte = katte;
        buyerLedger.weight = weight;
        buyerLedger.rate = rate;
        buyerLedger.bhardana = req.body.bhardana || 0;
        await buyerLedger.save();
    }
    await recalculateLedger(buyerId);

    // If implementing miller ledger update, can add here. But typically only buyer ledger for sales.

    res.json(bill);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating bill" });
  }
};