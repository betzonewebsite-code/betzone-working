import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'BETZONE Admin', description: 'BETZONE operations and administration' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
