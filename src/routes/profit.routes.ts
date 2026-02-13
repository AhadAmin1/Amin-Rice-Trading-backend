import { Router } from "express";
import { getProfits } from "../controllers/profit.controller";

const router = Router();

router.get("/", getProfits);

export default router;
