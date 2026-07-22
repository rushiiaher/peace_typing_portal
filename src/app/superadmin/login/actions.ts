'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function loginSuperAdmin(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Role gate — authenticating is not enough, the account must be a super admin.
  // Sign the session back out so a non-admin cannot reuse it on this portal.
  if (data.user?.user_metadata?.role !== 'super_admin') {
    await supabase.auth.signOut()
    return { error: 'You are not authorized to access this portal. Please use your own portal to sign in.' }
  }

  redirect('/superadmin/dashboard')
}
