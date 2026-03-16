'use client'

import { useState } from 'react'

export default function SetupPage() {
    const [status, setStatus] = useState('')
    const [loading, setLoading] = useState(false)

    const createSuperAdmin = async () => {
        setLoading(true)
        setStatus('Creating super admin...')
        
        try {
            const response = await fetch('/api/create-superadmin', {
                method: 'POST',
            })
            
            const data = await response.json()
            
            if (data.success) {
                setStatus('✅ Super Admin created!\n\nEmail: admin@typingportal.com\nPassword: admin123\n\n📧 To activate:\n1. Go to your Supabase Dashboard\n2. Authentication > Users\n3. Find admin@typingportal.com\n4. Click the 3 dots > Confirm email\n\nOr disable email confirmation in:\nAuthentication > Providers > Email > Confirm email: OFF')
            } else {
                setStatus('❌ Error: ' + data.error)
            }
        } catch (error: any) {
            setStatus('❌ Failed: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-8 border border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Setup Super Admin</h1>
                <p className="text-gray-600 mb-6">Click the button below to create the super admin user.</p>
                
                <button
                    onClick={createSuperAdmin}
                    disabled={loading}
                    className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition duration-200 disabled:bg-gray-400"
                >
                    {loading ? 'Creating...' : 'Create Super Admin'}
                </button>

                {status && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap">{status}</pre>
                    </div>
                )}
            </div>
        </div>
    )
}
