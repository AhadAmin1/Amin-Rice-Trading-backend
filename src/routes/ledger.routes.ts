import express from "express";
import { 
  getLedgerByParty, 
  addLedgerEntry, 
  getDashboardStats, 
  deleteLedgerEntry, 
  updateLedgerEntry, 
  getPartyBalances,
  syncAllPayments,
  getLedgerByStock,
  getLedgerByBill
} from "../controllers/ledger.controller";

const router = express.Router();

router.post("/sync-all", syncAllPayments);
router.get("/summary", getDashboardStats);
router.get("/balances", getPartyBalances);
router.get("/stock/:stockId", getLedgerByStock);
router.get("/bill/:billId", getLedgerByBill);

// Get ledger of a party
router.get("/:partyId", getLedgerByParty);

router.put("/:id", updateLedgerEntry);
router.delete("/:id", deleteLedgerEntry);

// Add new ledger entry
router.post("/", addLedgerEntry);

export default router;
