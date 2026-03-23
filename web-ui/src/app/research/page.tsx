'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Image as ImageIcon, MessageSquare, UserPlus, Save, ExternalLink, Activity, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ResearchPage() {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState('visual');
    const [results, setResults] = useState<any>({
        visual: [],
        vibe: [],
        dossier: null
    });

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsSearching(true);

        try {
            let endpoint = '';
            let body = {};

            if (activeTab === 'visual') {
                endpoint = 'osintVisualSearchTool';
                body = { query };
            } else if (activeTab === 'vibe') {
                endpoint = 'osintSentimentTool';
                body = { topic: query };
            } else {
                endpoint = 'dossierEnrichmentTool';
                body = { characterName: 'New Persona', location: 'Singapore', occupation: query };
            }

            const response = await fetch(`http://localhost:3400/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (activeTab === 'visual') {
                setResults((prev: any) => ({ ...prev, visual: data.result.images || [] }));
            } else if (activeTab === 'vibe') {
                setResults((prev: any) => ({ ...prev, vibe: data.result.discussions || [] }));
            } else {
                setResults((prev: any) => ({ ...prev, dossier: data.result || null }));
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#020617] text-slate-200">
            {/* Header */}
            <div className="mb-12">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="p-2 bg-cyan-500/20 rounded-xl">
                        <Activity className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
                        Research <span className="text-cyan-500">Studio</span>
                    </h1>
                </div>
                <p className="text-slate-400 max-w-2xl">
                    Gather real-world intelligence to power your cinematic narratives. Use OSINT to harvest visual references, analyze community sentiment, and build deep character dossiers.
                </p>
            </div>

            {/* Search Bar */}
            <div className="glass-panel p-6 mb-8 border border-white/5 shadow-2xl">
                <div className="flex items-center space-x-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -transform -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <Input
                            placeholder={`Search for ${activeTab === 'visual' ? 'visual styles...' : activeTab === 'vibe' ? 'trends and vibes...' : 'career paths and personas...'}`}
                            className="pl-10 bg-black/40 border-white/10 h-12 text-lg focus:ring-cyan-500"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <Button
                        size="lg"
                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 h-12"
                        onClick={handleSearch}
                        disabled={isSearching}
                    >
                        {isSearching ? 'Gathering Intelligence...' : 'Initiate Search'}
                    </Button>
                </div>
            </div>

            {/* Tabs Content */}
            <Tabs defaultValue="visual" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="bg-slate-900/50 border border-white/5 p-1 mb-8 h-14">
                    <TabsTrigger value="visual" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-400 h-12 px-6">
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Visual Studio
                    </TabsTrigger>
                    <TabsTrigger value="vibe" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-400 h-12 px-6">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Vibe Engine
                    </TabsTrigger>
                    <TabsTrigger value="dossier" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-400 h-12 px-6">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Dossier Lab
                    </TabsTrigger>
                </TabsList>

                {/* Visual Content */}
                <TabsContent value="visual">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.visual.map((img: any, i: number) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-panel overflow-hidden border border-white/5 group hover:border-cyan-500/50 transition-all"
                            >
                                <div className="aspect-video relative overflow-hidden">
                                    <img src={img.imageUrl} alt={img.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                                        <div className="flex space-x-2">
                                            <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 border-white/10 hover:bg-cyan-600">
                                                <Save className="w-4 h-4" />
                                            </Button>
                                            <a href={img.link} target="_blank" rel="noopener noreferrer">
                                                <Button size="icon" variant="secondary" className="h-8 w-8 bg-black/50 border-white/10 hover:bg-cyan-600">
                                                    <ExternalLink className="w-4 h-4" />
                                                </Button>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold text-sm truncate text-white">{img.title}</h3>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{img.source}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </TabsContent>

                {/* Vibe Content */}
                <TabsContent value="vibe">
                    <div className="space-y-4">
                        {results.vibe.map((disc: any, i: number) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="glass-panel p-6 border border-white/5 hover:border-cyan-500/30 transition-all flex items-start space-x-6"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <Badge variant="outline" className="text-cyan-400 border-cyan-400/30 bg-cyan-400/5">Source Discussion</Badge>
                                        <h3 className="font-bold text-white text-lg">{disc.title}</h3>
                                    </div>
                                    <p className="text-slate-400 text-sm italic">"{disc.snippet}"</p>
                                </div>
                                <a href={disc.link} target="_blank" rel="noopener noreferrer">
                                    <Button variant="ghost" size="icon" className="text-slate-500 hover:text-cyan-400">
                                        <ExternalLink className="w-5 h-5" />
                                    </Button>
                                </a>
                            </motion.div>
                        ))}
                    </div>
                </TabsContent>

                {/* Dossier Content */}
                <TabsContent value="dossier">
                    {results.dossier ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="glass-panel p-8 border border-cyan-500/20 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4">
                                    <UserPlus className="w-12 h-12 text-cyan-500/10" />
                                </div>
                                <h2 className="text-2xl font-black text-white uppercase italic mb-6">Persona <span className="text-cyan-500">Core</span></h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 block">Subject Identity</label>
                                        <div className="text-xl font-bold text-cyan-400">{results.dossier.character}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Career Status</div>
                                            <div className="text-white font-medium capitalize">{query}</div>
                                        </div>
                                        <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5">
                                            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Operational Hub</div>
                                            <div className="text-white font-medium">Singapore</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-white flex items-center">
                                    <Info className="w-5 h-5 mr-2 text-cyan-400" />
                                    Environmental Intelligence
                                </h3>
                                <div className="space-y-4">
                                    {results.dossier.research.careerInsights.map((insight: string, i: number) => (
                                        <div key={i} className="p-4 bg-slate-900/30 border-l-2 border-cyan-600 text-sm text-slate-300">
                                            {insight}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-20 glass-panel border border-dashed border-white/10">
                            <UserPlus className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500">Enter an occupation or persona description to initiate dossier enrichment.</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
