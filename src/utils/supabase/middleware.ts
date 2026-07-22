
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // ── Role-based access control ────────────────────────────────────────────
    const decision = checkAccess(request.nextUrl.pathname, user?.user_metadata?.role)

    if (decision.action === 'unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (decision.action === 'forbidden') {
        return NextResponse.json(
            { error: 'Forbidden — your account is not authorised for this portal.' },
            { status: 403 }
        )
    }
    if (decision.action === 'redirect') {
        const url = new URL(decision.to!, request.url)
        if (decision.reason) url.searchParams.set('error', decision.reason)
        return NextResponse.redirect(url)
    }

    return response
}

// ── Pure access-control decision (exported for testing) ──────────────────────
// Single enforcement point: covers pages, API routes and direct URL access.

// Public (no auth): portal selection, the three login pages, setup
const PUBLIC = ['/', '/setup', '/login',
    '/superadmin/login', '/institute/login', '/student/login']

// Authenticated but role-exempt: the post-login role probes themselves
const ROLE_EXEMPT = ['/api/institute/verify-login', '/api/student/verify-login']

// prefix → required role → that portal's login page
const GUARDED: Array<[string, string, string]> = [
    ['/superadmin', 'super_admin', '/superadmin/login'],
    ['/api/admin', 'super_admin', '/superadmin/login'],
    ['/institute', 'institute_admin', '/institute/login'],
    ['/api/institute', 'institute_admin', '/institute/login'],
    ['/student', 'student', '/student/login'],
    ['/api/student', 'student', '/student/login'],
]

const LOGIN_FOR_ROLE: Record<string, string> = {
    super_admin: '/superadmin/login',
    institute_admin: '/institute/login',
    student: '/student/login',
}

export type AccessDecision = {
    action: 'allow' | 'unauthorized' | 'forbidden' | 'redirect'
    to?: string
    reason?: string
}

export function checkAccess(path: string, role?: string): AccessDecision {
    if (PUBLIC.includes(path) || ROLE_EXEMPT.includes(path)) return { action: 'allow' }

    const rule = GUARDED.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))
    if (!rule) return { action: 'allow' }

    const [, requiredRole, loginPage] = rule
    const isApi = path.startsWith('/api/')

    if (!role) {
        return isApi ? { action: 'unauthorized' } : { action: 'redirect', to: loginPage }
    }
    if (role !== requiredRole) {
        return isApi
            ? { action: 'forbidden' }
            : { action: 'redirect', to: LOGIN_FOR_ROLE[role] ?? '/', reason: 'wrong_portal' }
    }
    return { action: 'allow' }
}
