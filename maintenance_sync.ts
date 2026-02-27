import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LedgerEntry from './src/models/LedgerEntry';
import Bill from './src/models/Bill';
import Stock from './src/models/Stock';

dotenv.config();

async function sync() {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error("No MONGO_URI found in .env");
        
        console.log('Connecting to DB...');
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const bills = await Bill.find();
        console.log(`Syncing ${bills.length} bills...`);
        for (const bill of bills) {
            const entries = await LedgerEntry.find({ billId: bill._id });
            const actualPaid = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
            
            let newStatus = 'unpaid';
            if (actualPaid >= bill.totalAmount - 1) {
                newStatus = 'paid';
            } else if (actualPaid > 0) {
                newStatus = 'partial';
            }
            
            console.log(`Bill ${bill.billNumber}: Old Paid: ${bill.paidAmount}, New Paid: ${actualPaid}, Status: ${newStatus}`);
            await Bill.updateOne({ _id: bill._id }, { $set: { paidAmount: actualPaid, status: newStatus } });
        }

        const stocks = await Stock.find();
        console.log(`Syncing ${stocks.length} stocks...`);
        for (const stock of stocks) {
            const entries = await LedgerEntry.find({ stockId: stock._id });
            const actualPaid = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
            
            let newStatus = 'unpaid';
            if (actualPaid >= stock.totalAmount - 1) {
                newStatus = 'paid';
            } else if (actualPaid > 0) {
                newStatus = 'partial';
            }
            
            console.log(`Stock ${stock.receiptNumber}: Old Paid: ${stock.paidAmount}, New Paid: ${actualPaid}, Status: ${newStatus}`);
            await Stock.updateOne({ _id: stock._id }, { $set: { paidAmount: actualPaid, status: newStatus } });
        }

        console.log('Sync complete');
        process.exit(0);
    } catch (err) {
        console.error('Sync failed:', err);
        process.exit(1);
    }
}

sync();
