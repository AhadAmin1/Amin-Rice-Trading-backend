import { Router } from "express";
import { 
  getCashEntries, 
  addCashEntry 
} from "../controllers/cash.controller";

const router = Router();

router.get("/", getCashEntries);
router.post("/", addCashEntry);

export default router;
