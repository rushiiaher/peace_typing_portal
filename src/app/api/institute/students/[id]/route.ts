import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

async function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// GET — fetch single student details
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await props.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = await getAdminClient();
        const { data, error } = await admin
            .from('students')
            .select(`
                *,
                batches ( id, batch_name, batch_code, courses ( id, name ) )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;
        return NextResponse.json({ student: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PATCH — update student profile / password
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await props.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const {
            name, phone, address, batch_id, is_active, password,
            first_name, father_name, surname, mother_name,
            aadhar_card_no, date_of_birth, blood_group,
            guardian_name, guardian_phone, photo_url,
        } = body;

        const admin = await getAdminClient();

        // Update auth metadata (and optionally password)
        const authPayload: any = { user_metadata: { full_name: name, phone: phone || null } };
        if (password && password.length >= 8) authPayload.password = password;
        const { error: authError } = await admin.auth.admin.updateUserById(id, authPayload);
        if (authError) throw authError;

        // Update students table
        const { data, error } = await admin
            .from('students')
            .update({
                name,
                first_name: first_name || null,
                father_name: father_name || null,
                surname: surname || null,
                mother_name: mother_name || null,
                phone: phone || null,
                address: address || null,
                batch_id: batch_id || null,
                is_active,
                photo_url: photo_url ?? null,
                aadhar_card_no: aadhar_card_no || null,
                date_of_birth: date_of_birth || null,
                blood_group: blood_group || null,
                guardian_name: guardian_name || null,
                guardian_phone: guardian_phone || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select().single();

        if (error) throw error;
        return NextResponse.json({ student: data });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE — remove student from auth + students table
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await props.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = await getAdminClient();
        // Delete student first (FK might exist, but usually students table is the child of auth.users)
        // Wait, students table is REFERENCES auth.users(id).
        // If we delete auth user first, it might fail or delete student via CASCADE.
        // Better delete from students first.
        const { error: studentError } = await admin.from('students').delete().eq('id', id);
        if (studentError) throw studentError;

        const { error: authError } = await admin.auth.admin.deleteUser(id);
        if (authError) throw authError;

        return NextResponse.json({ message: 'Student deleted.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
