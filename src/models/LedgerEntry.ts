import mongoose, { Types } from 'mongoose';

export interface ILedgerEntry extends mongoose.Document {
  partyId: Types.ObjectId;
  billId?: Types.ObjectId;
  date: string;
  particulars: string;
  billNo?: string;
  katte?: number;
  weight?: number;
  rate?: number;
  debit: number;
  credit: number;
  balance: number;
}

const LedgerEntrySchema = new mongoose.Schema<ILedgerEntry>(
  {
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
    billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
    date: { type: String, required: true },
    particulars: { type: String, required: true },
    billNo: String,
    katte: Number,
    weight: Number,
    rate: Number,
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balance: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.LedgerEntry || mongoose.model<ILedgerEntry>('LedgerEntry', LedgerEntrySchema);
