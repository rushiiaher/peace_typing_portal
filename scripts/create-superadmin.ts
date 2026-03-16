import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createSuperAdmin() {
  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@typingportal.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: {
        role: 'super_admin',
        full_name: 'Super Admin'
      }
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return
    }

    console.log('✅ Super Admin user created successfully!')
    console.log('Email: admin@typingportal.com')
    console.log('Password: admin123')
    console.log('User ID:', authData.user.id)

  } catch (error) {
    console.error('Error:', error)
  }
}

createSuperAdmin()
