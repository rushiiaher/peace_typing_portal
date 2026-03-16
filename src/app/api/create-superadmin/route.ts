import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    const { data, error } = await supabase.auth.signUp({
      email: 'admin@typingportal.com',
      password: 'admin123',
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/superadmin/dashboard`,
        data: {
          role: 'super_admin',
          full_name: 'Super Admin'
        }
      }
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Super Admin created. Go to Supabase Dashboard > Authentication > Users and confirm the email manually.',
      user: data.user 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 })
  }
}
