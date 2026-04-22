import { Dashboard, School, Business, MenuBook, Assignment, Payment, People, Assessment, SwapHoriz, AccountBalance, CurrencyRupee, Settings, Keyboard, Speed, Description, Article, Email, Quiz, SupportAgent, EmojiEvents } from '@mui/icons-material';

export const superAdminMenuItems = [
  { text: 'Dashboard', icon: <Dashboard />, href: '/superadmin/dashboard' },
  { text: 'Courses', icon: <School />, href: '/superadmin/courses' },
  { text: 'Course Allocation', icon: <SwapHoriz />, href: '/superadmin/course-allocation' },
  { text: 'Institutes', icon: <Business />, href: '/superadmin/institutes' },
  { text: 'Content', icon: <MenuBook />, href: '/superadmin/content' },
  { text: 'Exams', icon: <Assignment />, href: '/superadmin/exams' },
  { text: 'Final Results', icon: <EmojiEvents />, href: '/superadmin/final-results' },
  { text: 'Payments', icon: <Payment />, href: '/superadmin/payments' },
  { text: 'Users', icon: <People />, href: '/superadmin/users' },
  { text: 'Reports', icon: <Assessment />, href: '/superadmin/reports' },
  { text: 'Support', icon: <SupportAgent />, href: '/superadmin/support' },
];

export const instituteAdminMenuItems = [
  { text: 'Dashboard', icon: <Dashboard />, href: '/institute/dashboard' },
  { text: 'Courses', icon: <School />, href: '/institute/courses' },
  { text: 'Students', icon: <People />, href: '/institute/students' },
  { text: 'Batches', icon: <MenuBook />, href: '/institute/batches' },
  { text: 'Fee Collection', icon: <Payment />, href: '/institute/fees' },
  { text: 'Pay to Admin', icon: <AccountBalance />, href: '/institute/payment-to-admin' },
  { text: 'Exams', icon: <Assignment />, href: '/institute/exams' },
  { text: 'Reports', icon: <Assessment />, href: '/institute/reports' },
  { text: 'Settings', icon: <Settings />, href: '/institute/settings' },
  { text: 'Support', icon: <SupportAgent />, href: '/institute/support' },
];

export const studentMenuItems = [
  { text: 'Dashboard', icon: <Dashboard />, href: '/student/dashboard' },
  { text: 'Keyboard Lessons', icon: <Keyboard />, href: '/student/practice/keyboard' },
  { text: 'Speed Practice', icon: <Speed />, href: '/student/practice/speed' },
  { text: 'Letter Writing', icon: <Description />, href: '/student/practice/letter' },
  { text: 'Statement Writing', icon: <Article />, href: '/student/practice/statement' },
  { text: 'Email Writing', icon: <Email />, href: '/student/practice/email' },
  { text: 'MCQ Practice', icon: <Quiz />, href: '/student/practice/mcq' },
  { text: 'Exams', icon: <Assignment />, href: '/student/exams' },
  { text: 'Support', icon: <SupportAgent />, href: '/student/support' },
];
