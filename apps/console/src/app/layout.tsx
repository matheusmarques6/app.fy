import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AppFy Console',
  description: 'E-commerce App Builder - Admin Console',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
