import { NextResponse } from 'next/server'

// DISABLED — this endpoint was publicly callable and created a super admin
// with hardcoded credentials (admin@typingportal.com / admin123).
// The super admin already exists; provisioning any further ones must be done
// from the Supabase dashboard, not from an unauthenticated HTTP endpoint.
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is disabled. Create admin accounts via the Supabase dashboard.' },
    { status: 410 }
  )
}
