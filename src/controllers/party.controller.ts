import { Request, Response } from 'express';
import Party from '../models/Party';
import LedgerEntry from '../models/LedgerEntry';

export const getParties = async (req: Request, res: Response) => {
  console.log("🔍 Controller: getParties started");
  try {
    const parties = await Party.find().sort({ createdAt: -1 });
    console.log(`✅ Controller: getParties success - Found ${parties.length} parties`);
    res.json(parties);
  } catch (error: any) {
    console.error("❌ Controller: getParties error:", error.message);
    res.status(500).json({ message: "Error fetching parties", error: error.message });
  }
};

export const createParty = async (req: Request, res: Response) => {
  console.log("📝 Controller: createParty started", req.body);
  try {
    const { name, type } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        message: "name aur type dono required hain"
      });
    }

    const party = await Party.create({ name, type });
    console.log("✅ Controller: createParty success", party._id);
    res.status(201).json(party);
  } catch (error: any) {
    console.error("❌ Controller: createParty error:", error.message);
    res.status(500).json({ message: "Error creating party", error: error.message });
  }
};

export const updateParty = async (req: Request, res: Response) => {
  console.log("updateParty started", req.params.id);
  try {
    const party = await Party.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(party);
  } catch (error: any) {
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};

export const deleteParty = async (req: Request, res: Response) => {
  const { id } = req.params;
  console.log("deleteParty started", id);
  try {
    // ❗ Party ka poora ledger bhi delete hoga
    await LedgerEntry.deleteMany({ partyId: id });
    await Party.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
};
