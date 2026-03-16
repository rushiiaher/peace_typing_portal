const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hlawjwvbtxcddasvdrto.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsYXdqd3ZidHhjZGRhc3ZkcnRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTcwNTEsImV4cCI6MjA4NjgzMzA1MX0.voflWfcn_vO0Sq5_0ehE-rt4MpJNcTXzM4jEr8Nqfao';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: courses, error: cErr } = await supabase.from('courses').select('id, name, exam_fee, delivery_fee').limit(5);
    console.log('Courses:', courses, cErr);
}
test();
