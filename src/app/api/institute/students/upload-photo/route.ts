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

// POST /api/institute/students/upload-photo
// Body: FormData { file: File, student_id: string }
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const studentId = formData.get('student_id') as string | null;

        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: 'File exceeds 3 MB limit' }, { status: 400 });

        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const allowed = ['jpg', 'jpeg', 'png', 'webp'];
        if (!allowed.includes(ext)) return NextResponse.json({ error: 'Only JPG, PNG or WebP allowed' }, { status: 400 });

        // Unique filename: student-photos/<studentId or timestamp>.<ext>
        const filename = studentId
            ? `student-photos/${studentId}.${ext}`
            : `student-photos/temp-${Date.now()}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const admin = getAdmin();

        // Ensure bucket exists — upsert is idempotent
        const { error: bucketErr } = await admin.storage.createBucket('student-photos', {
            public: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
            fileSizeLimit: 3 * 1024 * 1024,
        });
        // Ignore "already exists" error
        if (bucketErr && !bucketErr.message.includes('already exists')) {
            throw bucketErr;
        }

        // Upload (upsert to replace previous photo for same student)
        const { error: uploadErr } = await admin.storage
            .from('student-photos')
            .upload(filename, buffer, {
                contentType: file.type || `image/${ext}`,
                upsert: true,
            });

        if (uploadErr) throw uploadErr;

        // Get public URL
        const { data: urlData } = admin.storage
            .from('student-photos')
            .getPublicUrl(filename);

        return NextResponse.json({ url: urlData.publicUrl });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
