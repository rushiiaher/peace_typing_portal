'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function InstituteAdminLogin() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
            if (signInError) { setError(signInError.message); return }

            const role = data.user.user_metadata?.role
            if (role !== 'institute_admin') {
                await supabase.auth.signOut()
                setError('Access denied. This account is not registered as an Institute Admin.')
                return
            }
            router.push('/institute/dashboard')
            router.refresh()
        } catch (err: any) {
            setError(err.message ?? 'An unexpected error occurred.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Left branding panel */}
            <div className="hidden lg:flex lg:w-2/5 flex-col items-center justify-center p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
                <div className="absolute w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #f59e0b, transparent)', top: '-50px', left: '-50px' }} />
                <div className="absolute w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #93c5fd, transparent)', bottom: '50px', right: '-30px' }} />

                <div className="relative z-10 text-center">
                    <div className="inline-block p-3 rounded-full mb-6" style={{ background: 'rgba(255,255,255,0.15)', boxShadow: '0 0 0 6px rgba(255,255,255,0.1)' }}>
                        <Image
                            src="/Peacexperts_LOGO.png"
                            alt="Peacexperts Logo"
                            width={100}
                            height={100}
                            style={{ borderRadius: '50%', display: 'block' }}
                        />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white mb-2">PEACEXPERTS</h2>
                    <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>Pvt. Ltd. · Affiliated with MCA (Govt. of India)</p>
                    <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                        <p className="text-white font-bold text-lg">Institute Admin Portal</p>
                        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Manage students, batches & payments</p>
                    </div>
                </div>
            </div>

            {/* Right login panel */}
            <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden text-center mb-8">
                        <Image
                            src="/Peacexperts_LOGO.png"
                            alt="Peacexperts Logo"
                            width={70}
                            height={70}
                            style={{ borderRadius: '50%', display: 'inline-block', marginBottom: '12px' }}
                        />
                        <h1 className="text-2xl font-extrabold text-gray-900">PEACEXPERTS</h1>
                    </div>

                    <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                        <div className="mb-8">
                            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: '#2563eb', color: 'white' }}>Institute Admin</span>
                            <h1 className="text-2xl font-extrabold text-gray-900 mt-3">Welcome back</h1>
                            <p className="text-gray-500 text-sm mt-1">Sign in to manage your institute</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-50"
                                    placeholder="admin@yourinstitute.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={loading}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-50 pr-12"
                                        placeholder="••••••••"
                                    />
                                    <button type="button" onClick={() => setShowPassword(s => !s)} tabIndex={-1}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                                        {showPassword
                                            ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                            : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        }
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)' }}
                            >
                                {loading ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Signing in…
                                    </>
                                ) : 'Sign In to Institute Portal'}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition">← Back to Portal Selection</Link>
                        </div>

                        <p className="mt-4 text-center text-xs text-gray-400">Only Institute Admins can access this portal.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
