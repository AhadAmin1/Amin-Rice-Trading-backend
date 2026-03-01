import express from "express";
import { createBill, deleteBill, updateBill, getBills, getNextBillNumber } from "../controllers/bill.controller";

const router = express.Router();

router.get("/", getBills);
router.get("/next-number", getNextBillNumber);
router.post("/", createBill);
router.put("/:id", updateBill);
router.delete("/:id", deleteBill);

export default router;
