'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Keyboard,
    Speed,
    Description,
    Article,
    Email,
    Quiz,
    Dashboard,
    Assignment
} from '@mui/icons-material';

const menuItems = [
    { name: 'Dashboard', href: '/student/dashboard', icon: <Dashboard /> },
    { name: 'Keyboard Lessons', href: '/student/practice/keyboard', icon: <Keyboard /> },
    { name: 'Speed Practice', href: '/student/practice/speed', icon: <Speed /> },
    { name: 'Letter Writing', href: '/student/practice/letter', icon: <Description /> },
    { name: 'Statement Writing', href: '/student/practice/statement', icon: <Article /> },
    { name: 'Email Writing', href: '/student/practice/email', icon: <Email /> },
    { name: 'MCQ Practice', href: '/student/practice/mcq', icon: <Quiz /> },
    { name: 'Exams', href: '/student/exams', icon: <Assignment /> },
];

export default function StudentSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-screen flex flex-col fixed left-0 top-0 overflow-y-auto">
            <div className="p-6">
                <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">Typing Portal</h1>
                <p className="text-xs text-zinc-500 mt-1">Student Panel</p>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {menuItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                                }`}
                        >
                            {item.icon}
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-xs text-zinc-500 text-center">
                    &copy; 2024 Typing Portal
                </div>
            </div>
        </aside>
    );
}
