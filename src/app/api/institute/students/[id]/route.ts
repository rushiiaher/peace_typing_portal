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
        const admin = await getAdminClient();

        // Build update object containing ONLY the fields actually sent in the request.
        // This prevents wiping data when a partial update (e.g. only photo_url) is sent.
        const fieldMap: Record<string, (v: any) => any> = {
            name:           (v: any) => v,
            first_name:     (v: any) => v || null,
            father_name:    (v: any) => v || null,
            surname:        (v: any) => v || null,
            mother_name:    (v: any) => v || null,
            phone:          (v: any) => v || null,
            address:        (v: any) => v || null,
            batch_id:       (v: any) => v || null,
            is_active:      (v: any) => v,
            photo_url:      (v: any) => v ?? null,
            aadhar_card_no: (v: any) => v || null,
            date_of_birth:  (v: any) => v || null,
            blood_group:    (v: any) => v || null,
            guardian_name:  (v: any) => v || null,
            guardian_phone:  (v: any) => v || null,
        };

        const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const [key, transform] of Object.entries(fieldMap)) {
            if (key in body) {
                updateData[key] = transform(body[key]);
            }
        }

        // Update auth metadata only if relevant fields are being changed
        if ('name' in body || 'phone' in body || 'password' in body) {
            const authPayload: any = { user_metadata: {} };
            if ('name' in body) authPayload.user_metadata.full_name = body.name;
            if ('phone' in body) authPayload.user_metadata.phone = body.phone || null;
            if (body.password && body.password.length >= 6) authPayload.password = body.password;
            const { error: authError } = await admin.auth.admin.updateUserById(id, authPayload);
            if (authError) throw authError;
        }

        // Update students table
        const { data, error } = await admin
            .from('students')
            .update(updateData)
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
