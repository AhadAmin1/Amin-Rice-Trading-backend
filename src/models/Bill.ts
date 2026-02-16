import mongoose, { Types } from 'mongoose';

export interface IBill extends mongoose.Document {
  billNumber: string;
  date: string;
  millerId: Types.ObjectId;
  buyerId: Types.ObjectId;
  buyerName: string;
  millerName: string;
  billNo: string;
  itemName: string;
  katte: number;
  weight: number;
  rate: number;
  rateType: string; // 'per_kg' | 'per_katta'
  totalAmount: number;
  stockId: Types.ObjectId;
  purchaseCost: number;
  profit: number;
}

const BillSchema = new mongoose.Schema<IBill>(
  {
    billNumber: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    millerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
    buyerName: { type: String, required: true },
    millerName: { type: String, required: true },
    billNo: { type: String, required: true },
    itemName: { type: String, required: true },
    katte: { type: Number, required: true },
    weight: { type: Number, required: true },
    rate: { type: Number, required: true },
    rateType: { type: String, enum: ['per_kg', 'per_katta'], default: 'per_kg' },
    totalAmount: { type: Number, required: true },
    stockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock' },
    purchaseCost: Number,
    profit: Number,
  },
  { timestamps: true }
);

export default mongoose.models.Bill || mongoose.model<IBill>('Bill', BillSchema);
