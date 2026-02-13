import { Router } from 'express';
import {
  getParties,
  createParty,
  updateParty,
  deleteParty,
} from '../controllers/party.controller';

const router = Router();

router.get('/', getParties);
router.post('/', createParty);
router.put('/:id', updateParty);
router.delete('/:id', deleteParty);

export default router;
