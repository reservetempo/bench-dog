// /app/admin/layout.jsx

// Not linked from anywhere on the site, and hidden from search engines
export const metadata = {
  title: 'admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }) {
  return <div className="min-h-screen bg-white text-black font-sans">{children}</div>;
}
