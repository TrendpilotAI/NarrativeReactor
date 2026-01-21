'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Zap, BookOpen, Layers, Settings, Database, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Generator', path: '/generator', icon: Zap },
    { name: 'Story Bible', path: '/story-bible', icon: BookOpen },
    { name: 'Integrations', path: '/integrations', icon: Share2 },
    { name: 'Performance', path: '/performance', icon: Zap },
    { name: 'Assets', path: '/assets', icon: Layers }, // Placeholder
    { name: 'Data', path: '/data', icon: Database }, // Placeholder
    { name: 'Settings', path: '/settings', icon: Settings }, // Placeholder
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="w-64 h-full glass-panel border-r border-white/5 flex flex-col">
            <div className="p-8">
                <h1 className="text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
                    NARRATIVE <span className="text-cyan-500">REACTOR</span>
                </h1>
                <div className="mt-2 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs uppercase tracking-widest text-cyan-500/80">System Online</span>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-2 relative">
                {navItems.map((item) => {
                    const isActive = pathname === item.path;
                    const Icon = item.icon;

                    return (
                        <Link key={item.path} href={item.path} className="block relative group">
                            {isActive && (
                                <motion.div
                                    layoutId="activeNav"
                                    className="absolute inset-0 bg-cyan-500/10 rounded-lg border border-cyan-500/20 shadow-[0_0_15px_rgba(0,180,216,0.1)]"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                />
                            )}

                            <div className={cn(
                                "relative flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200",
                                isActive ? "text-cyan-400" : "text-gray-400 group-hover:text-white group-hover:bg-white/5"
                            )}>
                                <Icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_8px_rgba(0,180,216,0.5)]")} />
                                <span className="font-medium tracking-wide">{item.name}</span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4">
                <div className="p-4 rounded-xl bg-gradient-to-b from-cyan-900/20 to-transparent border border-cyan-500/20">
                    <div className="text-xs text-cyan-400 font-medium mb-1">CURRENT MODEL</div>
                    <div className="text-sm text-white font-bold flex items-center justify-between">
                        Gemini 1.5 Flash
                        <div className="w-2 h-2 bg-cyan-500 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}
