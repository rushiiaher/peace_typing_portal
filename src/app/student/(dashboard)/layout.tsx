import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import AdminLayout from '@/app/components/AdminLayout';
import { studentMenuItems } from '@/app/components/menuItems';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/student/login');

    // Block inactive students — even if they have a valid session
    const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: studentRow } = await admin
        .from('students')
        .select('is_active')
        .eq('id', user.id)
        .single();

    if (!studentRow || !studentRow.is_active) {
        // Sign out happens client-side on the login page via ?reason=inactive
        redirect('/student/login?reason=inactive');
    }

    return (
        <AdminLayout menuItems={studentMenuItems} title="Student Portal">
            {children}
        </AdminLayout>
    );
}
