import mongoose, { Types } from "mongoose";
import { Request, Response } from "express";
import LedgerEntry, { ILedgerEntry } from "../models/LedgerEntry";
import Party from "../models/Party";
import Bill from "../models/Bill";
import Stock from "../models/Stock";
import CashEntry from "../models/CashEntry";
import Profit from "../models/Profit";

// GET /ledger/:partyId  → Full ledger of a party with running balance
export const getLedgerByParty = async (req: Request, res: Response) => {
  console.log("🔍 Controller: getLedgerByParty started", req.params.partyId);
  try {
    const { partyId } = req.params;
    
    const ledger = await LedgerEntry.find({ partyId }).sort({ date: 1 });

    // Running balance calculation (if not stored)
    let balance = 0;
    const ledgerWithBalance = ledger.map(entry => {
      balance += entry.debit - entry.credit;
      return {
        ...entry.toObject(),
        balance
      };
    });

    console.log(`✅ Controller: getLedgerByParty success - Found ${ledger.length} entries`);
    res.json(ledgerWithBalance);
  } catch (error: any) {
    console.error("❌ Controller: getLedgerByParty error:", error.message);
    res.status(500).json({ message: "Error fetching ledger", error: error.message });
  }
};

// Helper: Sync Bill Paid Amount from Ledger Entries
export const syncBillPaidAmount = async (billId: string) => {
  const bill = await Bill.findById(billId);
  if (!bill) return;

  // Find all ledger entries that are explicitly linked to this bill
  const entries = await LedgerEntry.find({ billId });
  // Sum ONLY credits (payments) for the bill
  const actualPaid = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  
  bill.paidAmount = actualPaid;
  const tolerance = 1;
  if (bill.paidAmount >= bill.totalAmount - tolerance) {
      bill.status = 'paid';
  } else if (bill.paidAmount > 0) {
      bill.status = 'partial';
  } else {
      bill.status = 'unpaid';
  }
  await bill.save();
};

// Helper: Sync Stock Paid Amount from Ledger Entries
export const syncStockPaidAmount = async (stockId: string) => {
  const stock = await Stock.findById(stockId);
  if (!stock) return;

  const entries = await LedgerEntry.find({ stockId: new Types.ObjectId(stockId) });
  const actualPaid = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  
  stock.paidAmount = actualPaid;
  const tolerance = 0.5; // Tighter tolerance for accuracy
  if (stock.paidAmount >= stock.totalAmount - tolerance) {
      stock.status = 'paid';
  } else if (stock.paidAmount > 0) {
      stock.status = 'partial';
  } else {
      stock.status = 'unpaid';
  }
  
  await stock.save();
  console.log(`[SYNC_STOCK] ${stock.receiptNumber} | Paid: ${actualPaid}/${stock.totalAmount} | Status: ${stock.status}`);
};

// POST /ledger → Add new ledger entry
export const addLedgerEntry = async (req: Request, res: Response) => {
  try {
    const { partyId, billId, stockId, date, particulars, billNo, katte, weight, rate, debit, credit } = req.body;
    console.log(`[ADD_LEDGER] Party: ${partyId} | StockId: ${stockId} | Credit: ${credit}`);

    if (!partyId || (!debit && !credit)) {
      return res.status(400).json({ message: "partyId and debit/credit required" });
    }

    const lastEntry = await LedgerEntry.findOne({ partyId }).sort({ date: -1, createdAt: -1 });
    const lastBalance = lastEntry ? lastEntry.balance : 0;

    const newBalance = lastBalance + (debit || 0) - (credit || 0);

    let finalBillId = billId;
    let finalStockId = stockId;

    // If billId or stockId is provided but billNo is missing, try to fetch it
    let finalBillNo = billNo;
    if (!finalBillNo) {
      if (finalBillId) {
        const bill = await Bill.findById(finalBillId);
        if (bill) finalBillNo = bill.billNumber;
      } else if (finalStockId) {
        const stock = await Stock.findById(finalStockId);
        if (stock) finalBillNo = stock.receiptNumber;
      }
    }
    
    // Auto-Link fallback: If stockId is missing, try to find it from particulars (e.g., "for Receipt #S-101" or "S101")
    if (!finalStockId && particulars) {
        const match = particulars.match(/#?(S-?\d+)/i);
        if (match) {
            let rcp = match[1].toUpperCase();
            if (!rcp.startsWith('S-')) rcp = `S-${rcp.substring(1)}`; // Handle S101 -> S-101 if needed, or just ensure S- prefix
            // Actually simpler:
            const cleanRcp = rcp.includes('-') ? rcp : `S-${rcp.replace('S', '')}`;
            
            const linkedStock = await Stock.findOne({ receiptNumber: { $regex: new RegExp(`^${cleanRcp}$`, 'i') } });
            if (linkedStock) {
                finalStockId = linkedStock._id;
                if (!finalBillNo) finalBillNo = linkedStock.receiptNumber;
                console.log(`[AUTO_LINK] Linked "${particulars}" to Stock ${cleanRcp}`);
            }
        }
    }

    const entry = new LedgerEntry({
      partyId,
      billId: finalBillId,
      stockId: finalStockId,
      date,
      particulars,
      billNo: finalBillNo,
      katte,
      weight,
      rate,
      debit: debit || 0,
      credit: credit || 0,
      balance: newBalance
    });

    await entry.save();

    // Re-Sync linked Bill or Stock
    if (finalBillId) await syncBillPaidAmount(finalBillId);
    if (finalStockId) await syncStockPaidAmount(finalStockId);

    res.status(201).json(entry);
  } catch (error: any) {
    console.error("Ledger Entry Error:", error);
    res.status(500).json({ message: "Error adding ledger entry", error: error.message, stack: error.stack });
  }
};

// GET /ledger/summary
export const getDashboardStats = async (req: Request, res: Response) => {
  console.log("🔍 Controller: getDashboardStats started");
  try {
    // 1. Stock
    const stocks = await Stock.find();
    const totalStockKatte = stocks.reduce((sum, s) => sum + s.remainingKatte, 0);
    const totalStockWeight = stocks.reduce((sum, s) => sum + s.remainingWeight, 0);

    // 2. Cash Balance
    const lastCash = await CashEntry.findOne().sort({ date: -1, createdAt: -1 });
    const cashBalance = lastCash ? lastCash.balance : 0;

    // 3. Receivables (Buyers) & Payables (Millers)
    // We can aggregate LedgerEntry by party Type?
    // LedgerEntry doesn't have partyType directly stored?
    // It links to Party.
    // We can fetch all parties and their balances? Expensive.
    // Better: Fetch all ledger entries with balance? 
    // Ideally we should store current balance on Party model to make this fast.
    // But for now, let's aggregate LedgerEntry by partyId, get latest.
    
    const latestEntries = await LedgerEntry.aggregate([
      { $sort: { date: 1, createdAt: 1 } },
      { 
        $group: {
          _id: "$partyId",
          lastBalance: { $last: "$balance" },
          doc: { $last: "$$ROOT" } // to get other fields if needed
        }
      }
    ]);
    
    // Now we need to know if party is Buyer or Miller.
    // Populating party is needed.
    // Aggregate lookup?
    
    // Simpler approach for now: Fetch all parties.
    const parties = await Party.find();
    
    let totalReceivable = 0; // Buyers (assume credit positive means they owe us)
    let totalPayable = 0; // Millers (assume debit/credit logic? No, just use balance)
    
    // Re-checking balance logic from dataStore:
    // Miller Balance = Payable (We owe them).
    // Buyer Balance = Receivable (They owe us).
    
    latestEntries.forEach(entry => {
       const party = parties.find(p => p._id.toString() === entry._id.toString());
       if (party) {
         if (party.type === 'Miller') {
           totalPayable += entry.lastBalance;
         } else if (party.type === 'Buyer') {
           totalReceivable += entry.lastBalance;
         }
       }
    });

    // 4. Profit
    const profits = await Profit.find();
    const totalProfit = profits.reduce((sum, p) => sum + p.profit, 0);

    console.log("✅ Controller: getDashboardStats success");
    res.json({
      totalStockKatte,
      totalStockWeight,
      cashBalance,
      totalReceivable,
      totalPayable,
      totalProfit
    });
  } catch (err: any) {
    console.error("❌ Controller: getDashboardStats error:", err.message);
    res.status(500).json({ message: "Dashboard stats failed", error: err.message });
  }
};

// GET /ledger/balances
export const getPartyBalances = async (req: Request, res: Response) => {
  try {
    const latestEntries = await LedgerEntry.aggregate([
      { $sort: { date: 1, createdAt: 1 } },
      { 
        $group: {
          _id: "$partyId",
          lastBalance: { $last: "$balance" }
        }
      }
    ]);
    res.json(latestEntries);
  } catch (err) {
    res.status(500).json({ message: "Error fetching balances" });
  }
};

// PUT /ledger/:id
export const updateLedgerEntry = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { debit, credit, date, particulars } = req.body;

    const entry = await LedgerEntry.findById(id);
    if (!entry) return res.status(404).json({ message: "Ledger entry not found" });

    // ❌ Bill-linked entry block
    if (entry.billId) {
      return res.status(400).json({ message: "Bill ledger cannot be edited" });
    }

    entry.debit = debit;
    entry.credit = credit;
    entry.date = date;
    entry.particulars = particulars;

    await entry.save();
    await recalculateLedger(entry.partyId.toString());

    // Re-Sync linked entities
    if (entry.billId) await syncBillPaidAmount(entry.billId.toString());
    if (entry.stockId) await syncStockPaidAmount(entry.stockId.toString());

    res.json({ message: "Ledger entry updated" });
  } catch {
    res.status(500).json({ message: "Ledger update failed" });
  }
};

// DELETE /ledger/:id
export const deleteLedgerEntry = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const entry = await LedgerEntry.findById(id);
    if (!entry) return res.status(404).json({ message: "Ledger entry not found" });

    const partyIdToSync = entry.partyId.toString();
    const billId = entry.billId;
    const stockId = entry.stockId;

    await entry.deleteOne();
    await recalculateLedger(partyIdToSync);

    // Re-Sync linked entities
    if (billId) await syncBillPaidAmount(billId.toString());
    if (stockId) await syncStockPaidAmount(stockId.toString());

    res.json({ message: "Ledger entry deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Ledger delete failed" });
  }
};

// POST /ledger/sync-all
export const syncAllPayments = async (req: Request, res: Response) => {
    try {
        const bills = await Bill.find();
        for (const b of bills) {
            await syncBillPaidAmount(b._id.toString());
        }
        
        const stocks = await Stock.find();
        for (const s of stocks) {
            await syncStockPaidAmount(s._id.toString());
        }
        res.json({ message: "Successfully synced all party payments" });
    } catch (err: any) {
      console.error("Sync Error:", err);
      res.status(500).json({ message: "Sync failed", error: err.message, stack: err.stack });
    }
};

// Note: recalculateLedger only updates running balances. 
// It does NOT re-trigger bill.paidAmount updates to avoid loops or accidental double-counting.
export const recalculateLedger = async (partyId: string) => {
  const entries = await LedgerEntry.find({ partyId }).sort({ date: 1, createdAt: 1 });

  let balance = 0;

  for (const e of entries) {
    balance = balance + (e.debit || 0) - (e.credit || 0);
    e.balance = balance;
    await e.save();
  }
};

