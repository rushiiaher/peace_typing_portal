import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { amount, currency = 'INR', receipt, notes } = await req.json();

        console.log('Razorpay Order Request:', { amount, currency, receipt });

        if (amount === undefined || amount === null) {
            return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
        }

        const instance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });

        const options = {
            amount: Math.round(Number(amount) * 100), // amount in the smallest currency unit
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
            notes: notes || {},
        };

        const order = await instance.orders.create(options);
        return NextResponse.json(order);
    } catch (err: any) {
        console.error('Razorpay Order Error:', err);
        // Razorpay API errors are often nested in err.error
        const errorMessage = err?.error?.description || err?.message || 'Failed to create Razorpay order';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
