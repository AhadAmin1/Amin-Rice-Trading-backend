import mongoose, { Schema, Document } from 'mongoose';

export interface ICashEntry extends Document {
  date: string;
  description: string;
  billReference?: string;
  debit: number; // Cash In
  credit: number; // Cash Out
  balance: number;
}

const CashEntrySchema = new Schema({
  date: { type: String, required: true },
  description: { type: String, required: true },
  billReference: { type: String },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balance: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.model<ICashEntry>('CashEntry', CashEntrySchema);
