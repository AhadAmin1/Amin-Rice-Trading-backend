import mongoose from 'mongoose';

export interface IParty extends mongoose.Document {
  name: string;
  type: 'Buyer' | 'Miller';
  phone?: string;
  address?: string;
}

const PartySchema = new mongoose.Schema<IParty>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['Buyer', 'Miller'], required: true },
    phone: String,
    address: String,
  },
  { timestamps: true }
);

export default mongoose.models.Party || mongoose.model<IParty>('Party', PartySchema);
