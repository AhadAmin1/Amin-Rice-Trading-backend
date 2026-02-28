import mongoose, { Schema, Document } from 'mongoose';

export interface IStock extends Document {
  date: string;
  millerId: mongoose.Types.ObjectId;
  millerName: string;
  itemName: string;
  katte: number;
  weightPerKatta: number;
  totalWeight: number;
  purchaseRate: number;
  rateType: 'per_kg' | 'per_katta';
  totalAmount: number;
  remainingKatte: number;
  remainingWeight: number;
  bhardana?: number;
  receiptNumber: string;
  paidAmount: number;
  status: 'unpaid' | 'partial' | 'paid';
  paymentType?: 'cash' | 'credit';
  dueDays?: number;
  dueDate?: string;
}

const StockSchema = new Schema({
  date: { type: String, required: true },
  millerId: { type: Schema.Types.ObjectId, ref: 'Party', required: true },
  millerName: { type: String, required: true },
  itemName: { type: String, required: true },
  katte: { type: Number, required: true },
  weightPerKatta: { type: Number, required: true },
  totalWeight: { type: Number, required: true },
  purchaseRate: { type: Number, required: true },
  rateType: { type: String, enum: ['per_kg', 'per_katta'], required: true },
  totalAmount: { type: Number, required: true },
  remainingKatte: { type: Number, required: true },
  remainingWeight: { type: Number, required: true },
  bhardana: { type: Number, default: 0 },
  bhardanaRate: { type: Number, default: 0 },
  receiptNumber: { type: String, required: true, unique: true },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  paymentType: { type: String, enum: ['cash', 'credit'], default: 'cash' },
  dueDays: { type: Number },
  dueDate: { type: String },
}, { timestamps: true });

export default mongoose.models.Stock || mongoose.model<IStock>('Stock', StockSchema);
