import express from "express";
import { 
  getLedgerByParty, 
  addLedgerEntry, 
  getDashboardStats, 
  deleteLedgerEntry, 
  updateLedgerEntry, 
  getPartyBalances,
  syncAllPayments
} from "../controllers/ledger.controller";

const router = express.Router();

router.post("/sync-all", syncAllPayments);
router.get("/summary", getDashboardStats);
router.get("/balances", getPartyBalances);

// Get ledger of a party
router.get("/:partyId", getLedgerByParty);

router.put("/:id", updateLedgerEntry);
router.delete("/:id", deleteLedgerEntry);

// Add new ledger entry
router.post("/", addLedgerEntry);

export default router;
