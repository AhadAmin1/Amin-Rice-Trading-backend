import { Router } from "express";
import { 
  getStock, 
  addStock, 
  updateStock, 
  deleteStock 
} from "../controllers/stock.controller";

const router = Router();

router.get("/", getStock);
router.post("/", addStock);
router.put("/:id", updateStock);
router.delete("/:id", deleteStock);

export default router;
