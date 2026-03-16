/**
 * This layout intentionally renders NO wrapper — the speed session page
 * manages its own full-screen Word-style UI via position:fixed.
 * It still inherits the root layout (HTML/body/MUI theme) from app/layout.tsx.
 */
export default function SpeedSessionLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
