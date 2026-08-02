import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Veritine | A Staked Knowledge War',
  description:
    'Veritine turns controversial factual questions into structured, evidence-backed, ' +
    'economically accountable disputes, adjudicated by GenLayer Intelligent Contracts.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
