const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hlawjwvbtxcddasvdrto.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsYXdqd3ZidHhjZGRhc3ZkcnRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI1NzA1MSwiZXhwIjoyMDg2ODMzMDUxfQ.x9nP_gNdDPxkDh6Ojye6pWjel2OaC9ypqguf1E5XdP8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFees() {
    const { data: students, error } = await supabase
        .from('students')
        .select(`
            id, enrollment_number, name, email, is_active,
            batch_id,
            batches (
                id, batch_name, batch_code, course_id,
                courses ( id, name, code, exam_fee, delivery_fee, base_course_fee )
            ),
            student_fee_collection ( id, course_fee_collected, exam_fee_collected, total_collected, payment_mode, receipt_number, collected_at )
        `)
        .limit(5);

    if (error) {
        console.error("Query Error:", error);
    } else {
        console.log("Students Count:", students?.length);
        if (students?.length > 0) {
            console.log("Sample Student:", JSON.stringify(students[0], null, 2));
        }
    }
}
checkFees();
