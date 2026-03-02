import { Request, Response } from "express";
import CashEntry from "../models/CashEntry";
import LedgerEntry from "../models/LedgerEntry";
import Stock from "../models/Stock";
import Bill from "../models/Bill";
import { syncBillPaidAmount, syncStockPaidAmount } from "./ledger.controller";

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
    
    const newBalance = previousBalance + (credit || 0) - (debit || 0);

    const entry = new CashEntry({
      date,
      description,
      debit: debit || 0,
      credit: credit || 0,
      balance: newBalance,
      billReference
    });

    await entry.save();

    // --- Smart Linking Logic ---
    // Only link if description explicitly contains #S-xxx or #B-xxx (# is required, NOT optional)
    const stockMatch = description.match(/#(S-?\d+)/i);
    const billMatch = description.match(/#(B-?\d+)/i);

    if (stockMatch) {
        let rawRcp = stockMatch[1].toUpperCase();
        // Normalize S101 to S-101
        const receiptNo = rawRcp.startsWith('S-') ? rawRcp : `S-${rawRcp.replace('S', '')}`;
        
        const stock = await Stock.findOne({ receiptNumber: { $regex: new RegExp(`^${receiptNo}$`, 'i') } });
        if (stock) {
            console.log(`[CASH_SMART_LINK] Linking to Stock ${receiptNo}`);
            
            // Create corresponding Ledger Entry for the Miller
            const lastLedger = await LedgerEntry.findOne({ partyId: stock.millerId }).sort({ date: -1, createdAt: -1 });
            const lastBalance = lastLedger ? lastLedger.balance : 0;
            // For Millers: Payment (Cash Out/Credit) is Debit in Ledger (decreases liability)
            // But this app uses Credit for Payments and Debit for Purchases?
            // Let's use the same logic as DirectPaymentDialog: credit: amount
            
            await LedgerEntry.create({
                partyId: stock.millerId,
                stockId: stock._id,
                date,
                particulars: `Cash Book: ${description}`,
                billNo: receiptNo,
                debit: 0,
                credit: debit || 0, // Debit (Cash Out) to Miller is Credit (decrease liability) in Ledger
                balance: lastBalance - (debit || 0)
            });
            
            await syncStockPaidAmount(stock._id.toString());
            const { notifyUpdate } = require("./ledger.controller"); 
            // Trigger UI update if possible or rely on frontend event
        }
    } else if (billMatch) {
        const billNo = billMatch[1].toUpperCase().startsWith('B-') ? billMatch[1].toUpperCase() : `B-${billMatch[1]}`;
        const bill = await Bill.findOne({ billNumber: { $regex: new RegExp(`^${billNo}$`, 'i') } });
        if (bill) {
             console.log(`[CASH_SMART_LINK] Linking to Bill ${billNo}`);
             const lastLedger = await LedgerEntry.findOne({ partyId: bill.buyerId }).sort({ date: -1, createdAt: -1 });
             const lastBalance = lastLedger ? lastLedger.balance : 0;
             
             await LedgerEntry.create({
                partyId: bill.buyerId,
                billId: bill._id,
                date,
                particulars: `Cash Book: ${description}`,
                billNo: billNo,
                debit: 0,
                credit: credit || 0, // Credit (Cash In) from Buyer is Credit (decreases debt) in Ledger
                balance: lastBalance - (credit || 0)
            });
            
            await syncBillPaidAmount(bill._id.toString());
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

    const oldDescription = entry.description;
    const oldDate = entry.date;

    entry.date = date;
    entry.description = description;
    entry.debit = debit || 0;
    entry.credit = credit || 0;

    await entry.save();
    await recalculateCash();

    // Sync with Ledger
    const ledgerEntry = await LedgerEntry.findOne({ 
        particulars: `Cash Book: ${oldDescription}`,
        date: oldDate
    });

    if (ledgerEntry) {
        ledgerEntry.date = date;
        ledgerEntry.particulars = `Cash Book: ${description}`;
        // Logic for debit/credit depends on if it was Miller or Buyer.
        // If it was Miller: credit (payment) decreases liability.
        // If it was Buyer: debit (receive) decreases their debt.
        // The original logic in addCashEntry was:
        // Stock/Miller: ledger.credit = cash.credit
        // Bill/Buyer: ledger.credit = cash.debit
        
        if (ledgerEntry.stockId) {
            ledgerEntry.credit = debit || 0; // Money Out (debit) is Miller Credit
        } else if (ledgerEntry.billId) {
            ledgerEntry.credit = credit || 0; // Money In (credit) is Buyer Credit
        }

        await ledgerEntry.save();
        const { recalculateLedger, syncBillPaidAmount, syncStockPaidAmount } = require("./ledger.controller");
        await recalculateLedger(ledgerEntry.partyId.toString());
        if (ledgerEntry.billId) await syncBillPaidAmount(ledgerEntry.billId.toString());
        if (ledgerEntry.stockId) await syncStockPaidAmount(ledgerEntry.stockId.toString());
    }

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

    // Find and delete linked ledger entry
    const ledgerEntry = await LedgerEntry.findOne({ 
        particulars: `Cash Book: ${entry.description}`,
        date: entry.date
    });

    if (ledgerEntry) {
        const partyId = ledgerEntry.partyId;
        const billId = ledgerEntry.billId;
        const stockId = ledgerEntry.stockId;
        
        await ledgerEntry.deleteOne();
        
        const { recalculateLedger, syncBillPaidAmount, syncStockPaidAmount } = require("./ledger.controller");
        await recalculateLedger(partyId.toString());
        if (billId) await syncBillPaidAmount(billId.toString());
        if (stockId) await syncStockPaidAmount(stockId.toString());
    }

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
    balance += (entry.credit || 0) - (entry.debit || 0);
    entry.balance = balance;
    await entry.save();
  }
};
