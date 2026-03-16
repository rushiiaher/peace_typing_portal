import AdminLayout from '@/app/components/AdminLayout';
import { studentMenuItems } from '@/app/components/menuItems';

export default function StudentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AdminLayout menuItems={studentMenuItems} title="Student Portal">
            {children}
        </AdminLayout>
    );
}
