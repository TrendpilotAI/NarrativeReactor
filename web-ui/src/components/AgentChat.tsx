'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, X, Edit3, Maximize2, Minimize2, Sparkles, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { usePathname } from 'next/navigation';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function AgentChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "I'm the Narrative Reactor Agent. I can help you direct scenes, assembly narratives, and generate scores. I can also see what you're looking at on this page.",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState('You are the Narrative Reactor Agent. You help users generate cinematic content for Signal Studio.');

    const pathname = usePathname();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Context injection from current page state
            const context = {
                page: pathname,
                time: new Date().toISOString(),
                // Placeholder for more detailed store context
                activeModule: pathname.split('/').pop() || 'Dashboard'
            };

            const response = await fetch('http://localhost:3400/agenticChat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: input,
                    history: messages.map(m => ({ role: m.role, content: m.content })),
                    context
                })
            });

            const data = await response.json();

            if (data.result) {
                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.result.response || "I processed your request, but had no specific response.",
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, aiMsg]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                id: 'error',
                role: 'assistant',
                content: "I'm having trouble connecting to the reactor core.",
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            <AnimatePresence>
                {isOpen && !isMinimized && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="w-96 h-[500px] mb-4 glass-panel border border-cyan-500/20 shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                                    <Bot className="w-5 h-5 text-cyan-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Narrative Agent</h3>
                                    <div className="flex items-center space-x-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Watching {pathname}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={() => setShowPromptEditor(true)}>
                                    <Settings className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={() => setIsMinimized(true)}>
                                    <Minimize2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400" onClick={() => setIsOpen(false)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
                            <div className="space-y-4">
                                {messages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                                                ? 'bg-cyan-600 text-white rounded-tr-none'
                                                : 'bg-slate-900 border border-border text-gray-200 rounded-tl-none'
                                            }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-900 border border-border p-3 rounded-2xl rounded-tl-none flex space-x-1 items-center">
                                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-4 border-t border-border bg-card/30">
                            <div className="flex items-center space-x-2">
                                <Input
                                    className="bg-black/50 border-border text-white text-sm"
                                    placeholder="Type a command..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <Button size="icon" className="bg-cyan-500 hover:bg-cyan-400 shrink-0" onClick={handleSendMessage}>
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Prompt Editor Overlay */}
            <AnimatePresence>
                {showPromptEditor && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            className="bg-slate-950 border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white flex items-center">
                                    <Edit3 className="w-5 h-5 mr-2 text-cyan-400" />
                                    Configure Agent Prompt
                                </h3>
                                <Button variant="ghost" size="icon" onClick={() => setShowPromptEditor(false)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                            <textarea
                                className="w-full h-40 bg-black/50 border border-border rounded-xl p-4 text-sm text-gray-300 font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                            />
                            <div className="mt-6 flex justify-end space-x-3">
                                <Button variant="outline" onClick={() => setShowPromptEditor(false)}>Cancel</Button>
                                <Button className="bg-cyan-600 hover:bg-cyan-500" onClick={() => setShowPromptEditor(false)}>
                                    Save Instructions
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            {!isOpen || isMinimized ? (
                <motion.button
                    layoutId="chatToggle"
                    className="p-4 bg-cyan-600 rounded-full shadow-lg shadow-cyan-500/20 hover:bg-cyan-500 transition-colors flex items-center space-x-2"
                    onClick={() => {
                        setIsOpen(true);
                        setIsMinimized(false);
                    }}
                >
                    <Sparkles className="w-6 h-6 text-white" />
                    {isMinimized && <span className="text-white text-sm font-bold pr-2">Narrative Agent</span>}
                </motion.button>
            ) : null}
        </div>
    );
}
