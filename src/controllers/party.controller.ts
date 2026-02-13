import { Request, Response } from 'express';
import Party from '../models/Party';
import LedgerEntry from '../models/LedgerEntry';

export const getParties = async (_: Request, res: Response) => {
  const parties = await Party.find().sort({ createdAt: -1 });
  res.json(parties);
};

export const createParty = async (req: Request, res: Response) => {
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({
      message: "name aur type dono required hain"
    });
  }

  const party = await Party.create({ name, type });
  res.status(201).json(party);
};

export const updateParty = async (req: Request, res: Response) => {
  const party = await Party.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(party);
};

export const deleteParty = async (req: Request, res: Response) => {
  const { id } = req.params;

  // ❗ Party ka poora ledger bhi delete hoga
  await LedgerEntry.deleteMany({ partyId: id });
  await Party.findByIdAndDelete(id);

  res.json({ success: true });
};
