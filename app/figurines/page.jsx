// Dev-only sheet of every homepage figurine, enlarged, at four turns: /figurines
// (/figurines?only=bread shows one). It 404s in production builds.

import { notFound } from 'next/navigation';
import Sheet from './Sheet';

export default function Figurines({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Sheet only={searchParams?.only || ''} />;
}
