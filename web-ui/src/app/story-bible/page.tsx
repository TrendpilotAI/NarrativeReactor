'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Shield, Briefcase, Zap, Search, Loader2, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { osintResearchAction } from "../actions";

export default function StoryBiblePage() {
    const characters = [
        {
            name: "Maya Chen",
            role: "Protagonist / Senior Wealth Advisor",
            age: 38,
            icon: User,
            traits: ["Exhausted innovator", "Detail-oriented", "Driven by past failure"],
            desc: "Taiwanese-American senior advisor. Always wears a jade pendant. Seeking the '11-second answer' to prove her value.",
            promptKeywords: "navy blazer, jade pendant, sharp eyes, office setting"
        },
        {
            name: "Marcus Thompson",
            role: "Skeptic / Senior Partner",
            age: 45,
            icon: Briefcase,
            traits: ["Traditionalist", "Protective of legacy", "Cautious"],
            desc: "Third-generation advisor. Wears his father's Patek Philippe watch. Represents the 'old guard' that needs convincing.",
            promptKeywords: "silver temples, vintage watch, bespoke suit, leather armchair"
        },
        {
            name: "Elena Vasquez",
            role: "Compliance Gatekeeper",
            age: 52,
            icon: Shield,
            traits: ["Rigorous", "Former SEC examiner", "Fair but firm"],
            desc: "Chief Compliance Officer. The ultimate hurdle for any new technology. Needs audit trails, not black boxes.",
            promptKeywords: "silver-streaked dark hair, reading glasses, tailored dark suit, commanding presence"
        },
        {
            name: "Jamie Park",
            role: "Digital Native / Junior Analyst",
            age: 26,
            icon: Zap,
            traits: ["Impatient innovator", "Stanford CS", "Digital Native"],
            desc: "Representing the next generation of advisors. Wears AirPods and smart-casual attire. Seeking 'Decision Velocity' to disrupt legacy workflows.",
            promptKeywords: "non-binary presentation, rolled sleeves, AirPods, energetic expression"
        },
        {
            name: "Helen Murdoch",
            role: "High-Stakes Client / Business Mogul",
            age: 67,
            icon: Briefcase,
            traits: ["Demanding empire builder", "No-nonsense", "Quality-obsessed"],
            desc: "High-Net-Worth Client who values her time above all else. Wears Chanel suits. The target for the '11-second answer'.",
            promptKeywords: "silver hair precisely styled, Chanel suit, minimal exceptional jewelry"
        }
    ];

    // Research state
    const [researchLoading, setResearchLoading] = useState<string | null>(null);
    const [researchResult, setResearchResult] = useState<{ name: string; data: unknown } | null>(null);

    const handleResearch = async (characterName: string) => {
        setResearchLoading(characterName);
        setResearchResult(null);
        try {
            const result = await osintResearchAction(
                `${characterName} persona wealth advisor financial services AI technology`,
                'persona'
            );
            setResearchResult({ name: characterName, data: result });
        } catch (e) {
            setResearchResult({ name: characterName, data: { error: 'Failed to perform research' } });
        } finally {
            setResearchLoading(null);
        }
    };

    return (
        <div className="flex-1 space-y-6 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Story Bible</h2>
                    <p className="text-muted-foreground">The canonical source of truth for Narrative Reactor agents.</p>
                </div>
            </div>

            <Tabs defaultValue="characters" className="space-y-4">
                <TabsList className="bg-card border border-border">
                    <TabsTrigger value="characters">Characters</TabsTrigger>
                    <TabsTrigger value="brand">Brand Guidelines</TabsTrigger>
                    <TabsTrigger value="settings">Settings & World</TabsTrigger>
                </TabsList>

                <TabsContent value="characters">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {characters.map((char, i) => (
                            <Card key={i} className="bg-card border-border text-card-foreground hover:border-cyan-500/30 transition-all duration-300 shadow-lg group">
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <div>
                                        <CardTitle className="text-lg font-bold group-hover:text-cyan-400 transition-colors">{char.name}</CardTitle>
                                        <CardDescription className="text-muted-foreground mt-1">{char.role}</CardDescription>
                                    </div>
                                    <div className="p-2 bg-slate-800 rounded-full">
                                        <char.icon className="h-5 w-5 text-cyan-400" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-4">
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        {char.desc}
                                    </p>

                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Traits</p>
                                        <div className="flex flex-wrap gap-2">
                                            {char.traits.map(t => (
                                                <Badge key={t} variant="outline" className="border-border text-muted-foreground bg-slate-950/30">
                                                    {t}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-border mt-4">
                                        <p className="text-[10px] bg-black/30 p-2 rounded text-slate-500 font-mono">
                                            PROMPT_KEYS: {char.promptKeywords}
                                        </p>
                                    </div>

                                    {/* Research Button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResearch(char.name)}
                                        disabled={researchLoading !== null}
                                        className="w-full mt-2 bg-slate-900/50 border-slate-700 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-gray-300"
                                    >
                                        {researchLoading === char.name ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Researching...
                                            </>
                                        ) : (
                                            <>
                                                <Search className="w-4 h-4 mr-2" />
                                                Research Persona
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Research Modal */}
                <AnimatePresence>
                    {researchResult && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                            onClick={() => setResearchResult(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                className="bg-slate-950 border border-border rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between p-4 border-b border-border">
                                    <div className="flex items-center space-x-3">
                                        <Search className="w-5 h-5 text-cyan-400" />
                                        <h3 className="text-lg font-bold text-white">OSINT Research: {researchResult.name}</h3>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setResearchResult(null)}>
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>
                                <ScrollArea className="max-h-[60vh] p-4">
                                    {typeof researchResult.data === 'object' && researchResult.data !== null && 'response' in (researchResult.data as Record<string, unknown>) ? (
                                        <div className="prose prose-invert max-w-none">
                                            <p className="text-slate-300 whitespace-pre-wrap">
                                                {(researchResult.data as { response: string }).response}
                                            </p>
                                        </div>
                                    ) : (
                                        <pre className="text-sm text-gray-400 overflow-auto whitespace-pre-wrap">
                                            {JSON.stringify(researchResult.data, null, 2)}
                                        </pre>
                                    )}
                                </ScrollArea>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <TabsContent value="brand">
                    <Card className="bg-card border-border text-card-foreground shadow-lg">
                        <CardHeader>
                            <CardTitle>Signal Studio Brand DNA</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-3">Color Palette</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1">
                                        <div className="h-12 rounded bg-[#1E3A5F] w-full" />
                                        <p className="text-xs font-medium">Authority Navy</p>
                                        <p className="text-[10px] text-slate-500">#1E3A5F</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-12 rounded bg-[#00B4D8] w-full shadow-[0_0_15px_rgba(0,180,216,0.3)]" />
                                        <p className="text-xs font-medium">Innovation Cyan</p>
                                        <p className="text-[10px] text-slate-500">#00B4D8</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-12 rounded bg-[#FF6B35] w-full" />
                                        <p className="text-xs font-medium">Velocity Orange</p>
                                        <p className="text-[10px] text-slate-500">#FF6B35</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-12 rounded bg-[#FFD700] w-full" />
                                        <p className="text-xs font-medium">Achievement Gold</p>
                                        <p className="text-[10px] text-slate-500">#FFD700</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold mb-3">Voice & Tone</h3>
                                <div className="grid gap-3">
                                    <div className="p-3 rounded border border-slate-700 bg-slate-950/50">
                                        <p className="text-sm font-medium text-green-400 mb-1">Do This</p>
                                        <p className="text-sm text-slate-300">"Signal Studio delivers insights in 11 seconds."</p>
                                        <p className="text-xs text-slate-500 mt-1">Direct, confident, metric-driven.</p>
                                    </div>
                                    <div className="p-3 rounded border border-slate-700 bg-slate-950/50">
                                        <p className="text-sm font-medium text-red-400 mb-1">Don't Do This</p>
                                        <p className="text-sm text-slate-300">"We think our AI might be faster than others."</p>
                                        <p className="text-xs text-slate-500 mt-1">Vague, hesitant, unproven.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs >
        </div >
    );
}
