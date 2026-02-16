import mongoose, { Schema, Document } from 'mongoose';

export interface IProfit extends Document {
  billId: mongoose.Types.ObjectId;
  billNumber: string;
  date: string;
  buyerId: mongoose.Types.ObjectId;
  buyerName: string;
  itemName: string;
  katte: number;
  totalWeight: number;
  sellingAmount: number;
  purchaseCost: number;
  profit: number;
}

const ProfitSchema = new Schema({
  billId: { type: Schema.Types.ObjectId, ref: 'Bill', required: true },
  billNumber: { type: String, required: true },
  date: { type: String, required: true },
  buyerId: { type: Schema.Types.ObjectId, ref: 'Party', required: true },
  buyerName: { type: String, required: true },
  itemName: { type: String, required: true },
  katte: { type: Number, required: true },
  totalWeight: { type: Number, required: true },
  sellingAmount: { type: Number, required: true },
  purchaseCost: { type: Number, required: true },
  profit: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.models.Profit || mongoose.model<IProfit>('Profit', ProfitSchema);
