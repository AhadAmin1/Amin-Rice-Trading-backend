import express from "express";
import { createBill, deleteBill, updateBill, getBills } from "../controllers/bill.controller";

const router = express.Router();

router.get("/", getBills);
router.post("/", createBill);
router.put("/:id", updateBill);
router.delete("/:id", deleteBill);


export default router;
