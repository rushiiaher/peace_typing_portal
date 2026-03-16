'use client';

import AdminLayout from '@/app/components/AdminLayout';
import { instituteAdminMenuItems } from '@/app/components/menuItems';
import SupportPage from '@/app/components/SupportPage';

export default function InstituteSupportPage() {
    return (
        <AdminLayout menuItems={instituteAdminMenuItems} title="Institute Admin Panel">
            <SupportPage accentColor="#2563eb" gradientFrom="#1e3a8a" gradientTo="#3b82f6" />
        </AdminLayout>
    );
}
