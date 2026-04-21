import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const BUCKET = 'student-certificates';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function POST(request: NextRequest) {
    try {
        // Auth check
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const admin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Verify caller is an institute admin
        const { data: instAdmin } = await admin
            .from('institute_admins')
            .select('institute_id')
            .eq('id', user.id)
            .single();
        if (!instAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Parse multipart form
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const studentId = formData.get('student_id') as string | null;

        if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
        if (!studentId) return NextResponse.json({ error: 'student_id is required.' }, { status: 400 });

        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: 'File must be under 5 MB.' }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Only JPG, PNG, WebP, and PDF files are allowed.' },
                { status: 400 }
            );
        }

        // Determine extension
        const extMap: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
        };
        const ext = extMap[file.type] ?? 'bin';
        const path = `${instAdmin.institute_id}/${studentId}/prerequisite.${ext}`;

        // Upload to Supabase Storage (upsert so re-upload replaces old file)
        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadError } = await admin.storage
            .from(BUCKET)
            .upload(path, arrayBuffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);

        return NextResponse.json({ url: publicUrl });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
