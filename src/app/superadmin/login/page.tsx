'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { loginSuperAdmin } from './actions'

export default function SuperAdminLogin() {
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (formData: FormData) => {
        setLoading(true)
        setError('')
        const result = await loginSuperAdmin(formData)
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Left branding panel */}
            <div className="hidden lg:flex lg:w-2/5 flex-col items-center justify-center p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
                {/* Background circles */}
                <div className="absolute w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #f59e0b, transparent)', top: '-50px', left: '-50px' }} />
                <div className="absolute w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', bottom: '50px', right: '-30px' }} />

                <div className="relative z-10 text-center">
                    <div className="inline-block p-3 rounded-full mb-6" style={{ background: 'rgba(255,255,255,0.1)', boxShadow: '0 0 0 6px rgba(245,158,11,0.2)' }}>
                        <Image
                            src="/Peacexperts_LOGO.png"
                            alt="Peacexperts Logo"
                            width={100}
                            height={100}
                            style={{ borderRadius: '50%', display: 'block' }}
                        />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white mb-2">PEACEXPERTS</h2>
                    <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>Pvt. Ltd. · Affiliated with MCA (Govt. of India)</p>
                    <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <p className="text-white font-bold text-lg">Super Admin Portal</p>
                        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Full platform management access</p>
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
                            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full" style={{ background: '#1a1a2e', color: 'white' }}>Super Admin</span>
                            <h1 className="text-2xl font-extrabold text-gray-900 mt-3">Welcome back</h1>
                            <p className="text-gray-500 text-sm mt-1">Sign in to manage the platform</p>
                        </div>

                        <form action={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    disabled={loading}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                                    style={{ '--tw-ring-color': '#1a1a2e' } as any}
                                    placeholder="admin@peacexperts.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    disabled={loading}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                                    placeholder="••••••••"
                                />
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}
                            >
                                {loading ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Signing in…
                                    </>
                                ) : 'Sign In to Super Admin'}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition">← Back to Portal Selection</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
