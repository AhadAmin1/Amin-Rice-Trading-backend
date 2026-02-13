import express from "express";
import partyRoutes from "./party.routes";
import ledgerRoutes from "./ledger.routes";
import billRoutes from "./bill.routes";
import stockRoutes from "./stock.routes";
import cashRoutes from "./cash.routes";
import profitRoutes from "./profit.routes";

const router = express.Router();

router.use("/parties", partyRoutes);
router.use("/ledger", ledgerRoutes);
router.use("/bills", billRoutes);
router.use("/stock", stockRoutes);
router.use("/cash", cashRoutes);
router.use("/profit", profitRoutes);

export default router;
