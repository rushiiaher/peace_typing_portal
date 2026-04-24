import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

function getAdmin() {
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
    const admin = getAdmin();
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

    const { data: existing } = await admin
        .from('students')
        .select('enrollment_number')
        .eq('institute_id', instituteId)
        .like('enrollment_number', `${prefix}%`)
        .order('enrollment_number', { ascending: false })
        .limit(1);

    let nextSeq = 1;
    if (existing && existing.length > 0) {
        const lastNum = existing[0].enrollment_number?.split('-').pop();
        const parsed = parseInt(lastNum ?? '0', 10);
        if (!isNaN(parsed)) nextSeq = parsed + 1;
    }

    // Verify uniqueness — increment until free
    while (true) {
        const candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
        const { count } = await admin
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('enrollment_number', candidate);
        if ((count ?? 0) === 0) return candidate;
        nextSeq++;
    }
}

/**
 * Find an existing auth user by email using listUsers with a filter.
 * Returns the user object or null.
 */
async function findAuthUserByEmail(admin: any, email: string): Promise<any | null> {
    // listUsers supports server-side filter
    const { data, error } = await admin.auth.admin.listUsers({
        perPage: 1000,
        // filter is not supported in all SDK versions, so we filter client-side
    });
    if (error || !data?.users) return null;
    return data.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

// ─── GET — list students ──────────────────────────────────────────────────────
export async function GET() {
    try {
        const info = await getInstituteInfo();
        if (!info) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = getAdmin();
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
            prerequisite_cert_url,
        } = body;

        if (!first_name || !surname || !email || !password) {
            return NextResponse.json(
                { error: 'First name, surname, email and password are required.' },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();
        const fullName = [first_name, father_name, surname].filter(Boolean).join(' ');
        const admin = getAdmin();

        // ── Prerequisite certificate check ────────────────────────────────────
        if (batch_id) {
            const { data: batchData } = await admin
                .from('batches')
                .select('course_id, courses ( passing_criteria_wpm )')
                .eq('id', batch_id)
                .single();
            const wpm = (batchData as any)?.courses?.passing_criteria_wpm ?? 0;
            if (wpm >= 40 && !prerequisite_cert_url) {
                return NextResponse.json(
                    { error: `This course requires ${wpm} WPM. Please upload a valid prerequisite completion certificate before enrolling the student.` },
                    { status: 400 }
                );
            }
        }

        // ── Step 1: Check if a fully-registered student already exists ────────
        const { data: existingStudentRow } = await admin
            .from('students')
            .select('id, email')
            .eq('email', normalizedEmail)
            .maybeSingle();

        if (existingStudentRow) {
            // A students row exists with this email — check if auth user is also alive
            const { data: authCheck } = await admin.auth.admin.getUserById(existingStudentRow.id);
            if (authCheck?.user && !authCheck.user.deleted_at) {
                // Fully registered — genuine duplicate
                return NextResponse.json(
                    { error: 'A student with this email is already registered.' },
                    { status: 400 }
                );
            }
            // Auth user is gone/soft-deleted but students row remains — clean it up
            await admin.from('students').delete().eq('id', existingStudentRow.id);
        }

        // ── Step 2: Resolve auth user state for this email ────────────────────
        // Supabase soft-deletes users — their email stays reserved even after "deletion".
        // We must REUSE the existing auth user ID rather than trying to delete+recreate.
        const existingAuthUser = await findAuthUserByEmail(admin, normalizedEmail);

        let authUserId: string;

        if (existingAuthUser) {
            // Auth user exists (active or soft-deleted) — update it and reuse the ID
            const { data: updatedAuth, error: updateError } = await admin.auth.admin.updateUserById(
                existingAuthUser.id,
                {
                    password: password || 'student123',
                    email_confirm: true,
                    user_metadata: {
                        full_name: fullName,
                        role: 'student',
                        phone: phone || null,
                    },
                }
            );
            if (updateError) {
                return NextResponse.json({ error: `Auth update failed: ${updateError.message}` }, { status: 500 });
            }
            authUserId = updatedAuth.user.id;
        } else {
            // No auth user at all — create fresh
            const { data: newAuth, error: createError } = await admin.auth.admin.createUser({
                email: normalizedEmail,
                password: password || 'student123',
                email_confirm: true,
                user_metadata: {
                    full_name: fullName,
                    role: 'student',
                    phone: phone || null,
                },
            });
            if (createError) {
                return NextResponse.json({ error: createError.message }, { status: 400 });
            }
            authUserId = newAuth.user.id;
        }

        // ── Step 3: Generate enrollment number ────────────────────────────────
        const enrollment_number = await generateEnrollmentNumber(
            admin, info.institute_id, info.institute_code
        );

        // ── Step 4: Insert students row ───────────────────────────────────────
        const { data: studentData, error: studentError } = await admin.from('students').insert({
            id: authUserId,
            institute_id: info.institute_id,
            batch_id: batch_id || null,
            enrollment_number,
            name: fullName,
            first_name: first_name || null,
            father_name: father_name || null,
            surname: surname || null,
            email: normalizedEmail,
            phone: phone || null,
            address: address || null,
            is_active: is_active ?? true,
            aadhar_card_no: aadhar_card_no || null,
            blood_group: blood_group || null,
            date_of_birth: date_of_birth || null,
            mother_name: mother_name || null,
            guardian_name: guardian_name || null,
            guardian_phone: guardian_phone || null,
            photo_url: photo_url || null,
            prerequisite_cert_url: prerequisite_cert_url || null,
            prerequisite_cert_uploaded_at: prerequisite_cert_url ? new Date().toISOString() : null,
        }).select().single();

        if (studentError) {
            // Best-effort rollback — only if we just created a brand-new auth user
            if (!existingAuthUser) {
                try { await admin.auth.admin.deleteUser(authUserId); } catch (_) { }
            }
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
