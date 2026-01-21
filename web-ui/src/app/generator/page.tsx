'use client';

import { useState } from 'react';
import { generateContentAction } from '../actions';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Save, AlertTriangle, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GeneratorPage() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);
    const [complianceResult, setComplianceResult] = useState<{ passed: boolean, issues: string[] } | null>(null);

    const [episode, setEpisode] = useState('3.1');
    const [platform, setPlatform] = useState('Twitter');
    const [useClaude, setUseClaude] = useState(false);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGeneratedContent(null);
        setComplianceResult(null);

        try {
            const result = await generateContentAction(episode, platform, useClaude);
            setGeneratedContent(result.content);
            setComplianceResult(result.compliance);
        } catch (e) {
            setGeneratedContent("System Error: Failed to generate content.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="h-full flex space-x-6 p-6 overflow-hidden">
            {/* Input Panel */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-1/3 space-y-6"
            >
                <h1 className="text-2xl font-bold text-white mb-6">Content Generator</h1>

                <div className="glass-panel p-6 rounded-xl space-y-6 border-white/10">
                    <div className="space-y-2">
                        <Label className="text-gray-400">Select Episode</Label>
                        <Select value={episode} onValueChange={setEpisode}>
                            <SelectTrigger className="w-full bg-black/50 border-white/10 text-white">
                                <SelectValue placeholder="Select Episode" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                                <SelectItem value="3.1">Episode 3.1 - The 11-Second Answer</SelectItem>
                                <SelectItem value="3.2">Episode 3.2 - The Agents</SelectItem>
                                <SelectItem value="3.3">Episode 3.3 - Marcus Considers</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-gray-400">Platform</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Twitter', 'LinkedIn', 'Threads'].map((p) => (
                                <Button
                                    key={p}
                                    variant={platform === p ? "default" : "outline"}
                                    className={`w-full ${platform === p ? "bg-cyan-600 hover:bg-cyan-500 text-white border-0 shadow-[0_0_10px_rgba(0,180,216,0.3)]" : "bg-transparent border-white/10 text-gray-400 hover:text-white hover:bg-white/5"}`}
                                    onClick={() => setPlatform(p)}
                                >
                                    {p}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="claude"
                                checked={useClaude}
                                onCheckedChange={(c) => setUseClaude(!!c)}
                                className="border-white/20 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                            />
                            <Label htmlFor="claude" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-300">
                                Use Claude 3.5 Sonnet
                            </Label>
                        </div>
                    </div>

                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full h-12 text-lg font-bold tracking-wide bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border-0 shadow-lg shadow-cyan-500/20"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Generating...
                            </>
                        ) : 'GENERATE CONTENT'}
                    </Button>
                </div>
            </motion.div>

            {/* Output Panel */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex-1 space-y-6"
            >
                <h2 className="text-2xl font-bold text-white mb-6">Preview & Validation</h2>

                <div className="h-[calc(100%-4rem)] glass-panel rounded-xl p-8 flex flex-col relative overflow-hidden border-white/10">
                    <AnimatePresence mode="wait">
                        {!generatedContent && !isGenerating && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                key="empty"
                                className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50"
                            >
                                <div className="text-6xl mb-4">⚡</div>
                                <p className="text-lg">Select parameters and hit generate</p>
                            </motion.div>
                        )}

                        {generatedContent && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: "spring", stiffness: 100 }}
                                key="content"
                                className="flex flex-col h-full"
                            >
                                {/* Compliance Header */}
                                {complianceResult && (
                                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                                        <div className="flex items-center space-x-3">
                                            {complianceResult.passed ? (
                                                <div className="flex items-center space-x-2">
                                                    <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-950/30 px-3 py-1 text-sm">
                                                        <CheckCircle className="w-4 h-4 mr-2" />
                                                        Brand Compliance Passed
                                                    </Badge>
                                                </div>
                                            ) : (
                                                <Badge variant="destructive" className="px-3 py-1 text-sm bg-red-950/50 border-red-500/50 text-red-400">
                                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                                    Issues Detected
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                                                <Copy className="w-4 h-4 mr-2" /> Copy
                                            </Button>
                                            <Button variant="secondary" size="sm" className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30">
                                                <Save className="w-4 h-4 mr-2" /> Save
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto mb-6 pr-4 custom-scrollbar">
                                    <div className="prose prose-invert max-w-none">
                                        <p className="whitespace-pre-wrap font-sans text-lg leading-relaxed text-gray-200">
                                            {generatedContent}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
