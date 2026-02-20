import { Router } from "express";
import { 
  getCashEntries, 
  addCashEntry,
  updateCashEntry,
  deleteCashEntry
} from "../controllers/cash.controller";

const router = Router();

router.get("/", getCashEntries);
router.post("/", addCashEntry);
router.put("/:id", updateCashEntry);
router.delete("/:id", deleteCashEntry);

export default router;
