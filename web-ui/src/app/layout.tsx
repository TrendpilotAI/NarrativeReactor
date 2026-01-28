import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import AgentChat from '@/components/AgentChat';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Narrative Reactor',
  description: 'AI-Powered Cinematic Content Generation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`flex h-screen overflow-hidden ${inter.variable} font-sans bg-slate-950`}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8 relative">
          {/* Background Ambient Glow */}
          <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1]">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[100px]" />
          </div>
          {children}
          <AgentChat />
        </main>
      </body>
    </html>
  );
}
