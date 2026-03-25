import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

async function getAdminClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

async function getInstituteInfo(): Promise<{ institute_id: string; institute_code: string } | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const admin = await getAdminClient();
    const { data } = await admin
        .from('institute_admins')
        .select('institute_id, institutes(code)')
        .eq('id', user.id)
        .single();
    if (!data?.institute_id) return null;
    return {
        institute_id: data.institute_id,
        institute_code: (data as any).institutes?.code ?? 'STU',
    };
}

/** Auto-generate a unique enrollment/roll number: CODE-YYYY-NNNN */
async function generateEnrollmentNumber(admin: any, instituteId: string, instituteCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${instituteCode.toUpperCase()}-${year}-`;

    // Count existing students in this institute for this year
    const { count } = await admin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('institute_id', instituteId)
        .like('enrollment_number', `${prefix}%`);

    const seq = String((count ?? 0) + 1).padStart(4, '0');
    return `${prefix}${seq}`;
}

// ─── GET — list students ──────────────────────────────────────────────────────
export async function GET() {
    try {
        const info = await getInstituteInfo();
        if (!info) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = await getAdminClient();
        const { data, error } = await admin
            .from('students')
            .select(`
                id, enrollment_number, name, first_name, father_name, surname,
                email, phone, address, is_active, created_at,
                photo_url, aadhar_card_no, mother_name, guardian_name, guardian_phone,
                date_of_birth, blood_group,
                batch_id,
                batches ( id, batch_name, batch_code, courses ( id, name ) )
            `)
            .eq('institute_id', info.institute_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const students = (data ?? []).map((s: any) => ({
            id: s.id,
            enrollment_number: s.enrollment_number,
            name: s.name,
            first_name: s.first_name ?? '',
            father_name: s.father_name ?? '',
            surname: s.surname ?? '',
            email: s.email,
            phone: s.phone ?? '',
            address: s.address ?? '',
            mother_name: s.mother_name ?? '',
            guardian_name: s.guardian_name ?? '',
            guardian_phone: s.guardian_phone ?? '',
            aadhar_card_no: s.aadhar_card_no ?? '',
            photo_url: s.photo_url ?? null,
            date_of_birth: s.date_of_birth ?? '',
            blood_group: s.blood_group ?? '',
            is_active: s.is_active,
            created_at: s.created_at,
            batch_id: s.batch_id ?? '',
            batch_name: s.batches?.batch_name ?? '—',
            batch_code: s.batches?.batch_code ?? '',
            course_id: s.batches?.courses?.id ?? '',
            course_name: s.batches?.courses?.name ?? '—',
        }));

        return NextResponse.json({ students });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── POST — create student ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user: callerUser } } = await supabase.auth.getUser();
        if (!callerUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const info = await getInstituteInfo();
        if (!info) return NextResponse.json({ error: 'No institute assigned.' }, { status: 403 });

        const body = await request.json();
        const {
            first_name, father_name, surname,
            email, password,
            phone, address, is_active,
            aadhar_card_no, blood_group, date_of_birth,
            mother_name, guardian_name, guardian_phone,
            batch_id, photo_url,
        } = body;

        if (!first_name || !surname || !email || !password) {
            return NextResponse.json(
                { error: 'First name, surname, email and password are required.' },
                { status: 400 }
            );
        }

        const fullName = [first_name, father_name, surname].filter(Boolean).join(' ');
        const admin = await getAdminClient();

        // Auto-generate enrollment number
        const enrollment_number = await generateEnrollmentNumber(
            admin, info.institute_id, info.institute_code
        );

        // Create auth user
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
            email,
            password: password || 'student123',
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                role: 'student',
                phone: phone || null,
            },
        });
        if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

        // Insert into students table
        const { data: studentData, error: studentError } = await admin.from('students').insert({
            id: authData.user.id,
            institute_id: info.institute_id,
            batch_id: batch_id || null,
            enrollment_number,
            name: fullName,
            first_name: first_name || null,
            father_name: father_name || null,
            surname: surname || null,
            email,
            phone: phone || null,
            address: address || null,
            is_active: false,   // student cannot login until exam fee is paid to super admin
            aadhar_card_no: aadhar_card_no || null,
            blood_group: blood_group || null,
            date_of_birth: date_of_birth || null,
            mother_name: mother_name || null,
            guardian_name: guardian_name || null,
            guardian_phone: guardian_phone || null,
            photo_url: photo_url || null,
        }).select().single();

        if (studentError) {
            await admin.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json({ error: studentError.message }, { status: 500 });
        }

        return NextResponse.json(
            { student: studentData, enrollment_number },
            { status: 201 }
        );
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
