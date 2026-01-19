import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Kira — Your Friendly Guide Through Anything',
  description: 'A patient, knowledgeable AI companion who guides you through learning new skills, planning projects, or mastering anything. Like having a brilliant friend available 24/7.',
  keywords: ['AI assistant', 'learning companion', 'personal guide', 'AI tutor', 'voice AI'],
  openGraph: {
    title: 'Kira — Your Friendly Guide Through Anything',
    description: 'A patient, knowledgeable AI companion who guides you through learning new skills, planning projects, or mastering anything.',
    images: ['/kira-avatar.jpg'],
  },
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
