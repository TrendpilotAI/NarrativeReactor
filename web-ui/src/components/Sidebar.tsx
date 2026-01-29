'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Zap, BookOpen, Layers, Settings, Database, Share2, ChevronDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModels, LLM_MODELS } from '@/contexts/ModelContext';
import { useState } from 'react';

const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Generator', path: '/generator', icon: Zap },
    { name: 'Story Bible', path: '/story-bible', icon: BookOpen },
    { name: 'Integrations', path: '/integrations', icon: Share2 },
    { name: 'Performance', path: '/performance', icon: TrendingUp },
    { name: 'Assets', path: '/assets', icon: Layers },
    { name: 'Data', path: '/data', icon: Database },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Documentation', path: 'https://TrendpilotAI.github.io/NarrativeReactor/', icon: BookOpen },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { llmModel, setLlmModel } = useModels();
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

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

            {/* Model Selector Dropdown */}
            <div className="p-4">
                <div
                    className="p-4 rounded-xl bg-gradient-to-b from-cyan-900/20 to-transparent border border-cyan-500/20 cursor-pointer hover:border-cyan-500/40 transition-all"
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                >
                    <div className="text-xs text-cyan-400 font-medium mb-1 flex items-center justify-between">
                        CURRENT MODEL
                        <ChevronDown className={cn("w-4 h-4 transition-transform", isModelDropdownOpen && "rotate-180")} />
                    </div>
                    <div className="text-sm text-white font-bold flex items-center justify-between">
                        {llmModel.name}
                        <div className="w-2 h-2 bg-cyan-500 rounded-full" />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{llmModel.provider}</div>
                </div>

                {/* Dropdown Menu */}
                {isModelDropdownOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 bg-slate-900 border border-white/10 rounded-lg overflow-hidden shadow-lg"
                    >
                        {LLM_MODELS.map((model) => (
                            <div
                                key={model.id}
                                className={cn(
                                    "px-4 py-3 cursor-pointer transition-colors flex items-center justify-between",
                                    model.id === llmModel.id
                                        ? "bg-cyan-500/20 text-cyan-400"
                                        : "hover:bg-white/5 text-gray-300"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLlmModel(model);
                                    setIsModelDropdownOpen(false);
                                }}
                            >
                                <div>
                                    <div className="text-sm font-medium">{model.name}</div>
                                    <div className="text-[10px] text-slate-500">{model.provider}</div>
                                </div>
                                {model.id === llmModel.id && (
                                    <div className="w-2 h-2 bg-cyan-500 rounded-full" />
                                )}
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
