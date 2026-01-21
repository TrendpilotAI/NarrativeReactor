'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Zap,
    TrendingUp,
    MessageSquare,
    Users,
    Eye,
    ThumbsUp,
    Share2,
    RefreshCcw,
    Loader2,
    Calendar,
    ArrowUpRight
} from "lucide-react";
import { getPerformanceDataAction, getMentionsAction, listIntegrationsAction } from "../actions";

interface Metric {
    label: string;
    value: number;
    change: string;
}

interface Mention {
    id: string;
    text: string;
    createdAt: string;
    author: {
        name: string;
        username: string;
        avatar: string;
    }
}

export default function PerformancePage() {
    const [metrics, setMetrics] = useState<Metric[]>([]);
    const [mentions, setMentions] = useState<Mention[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [provider, setProvider] = useState<string | null>(null);

    useEffect(() => {
        init();
    }, []);

    async function init() {
        setLoading(true);
        try {
            const integrations = await listIntegrationsAction();
            const connected = integrations.find((i: any) => i.connected);
            if (connected) {
                setProvider(connected.provider);
                await fetchData(connected.provider);
            }
        } catch (error) {
            console.error("Failed to initialize performance page:", error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchData(p: string) {
        setRefreshing(true);
        try {
            const [perfData, mentionData] = await Promise.all([
                getPerformanceDataAction(p),
                getMentionsAction(p)
            ]);
            setMetrics(perfData);
            setMentions(mentionData);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setRefreshing(false);
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
        );
    }

    if (!provider) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="p-4 rounded-full bg-slate-900 border border-border">
                    <Share2 className="w-12 h-12 text-slate-500" />
                </div>
                <h2 className="text-2xl font-bold text-white">No Integrations Connected</h2>
                <p className="text-muted-foreground text-center max-w-md">
                    Connect a social account to start tracking performance and interactions in real-time.
                </p>
                <Button className="bg-cyan-600 hover:bg-cyan-500" onClick={() => window.location.href = '/integrations'}>
                    Go to Integrations
                </Button>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Performance Dashboard</h2>
                    <p className="text-muted-foreground mt-1">Real-time feedback loop from your connected social channels.</p>
                </div>
                <Button
                    variant="outline"
                    className="border-white/10 hover:bg-white/5"
                    onClick={() => fetchData(provider)}
                    disabled={refreshing}
                >
                    {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                    Refresh Data
                </Button>
            </div>

            {/* Metrics Overview */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {metrics.map((metric) => (
                    <Card key={metric.label} className="bg-slate-900/40 border-white/5 hover:border-cyan-500/30 transition-all duration-300 overflow-hidden group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                                {metric.label}
                            </CardTitle>
                            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                                {metric.label === 'Impressions' && <Eye className="w-4 h-4 text-cyan-400" />}
                                {metric.label === 'Likes' && <ThumbsUp className="w-4 h-4 text-cyan-400" />}
                                {metric.label === 'Retweets' && <Share2 className="w-4 h-4 text-cyan-400" />}
                                {metric.label === 'Replies' && <MessageSquare className="w-4 h-4 text-cyan-400" />}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-white">{metric.value.toLocaleString()}</div>
                            <div className="flex items-center mt-1 text-xs text-green-400 font-medium">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                {metric.change}
                                <span className="text-muted-foreground ml-1 font-normal text-[10px] uppercase tracking-tighter">from last week</span>
                            </div>
                        </CardContent>
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Card>
                ))}
            </div>

            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
                {/* Recent Mentions & Feed */}
                <Card className="lg:col-span-2 bg-slate-900/40 border-white/5">
                    <CardHeader className="border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg text-white">Social Feed</CardTitle>
                                <CardDescription>Recent mentions and interactions across platforms</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px] border-cyan-500/20 text-cyan-400">
                                LIVE STREAM
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-white/5">
                            {mentions.length > 0 ? mentions.map((mention) => (
                                <div key={mention.id} className="p-6 hover:bg-white/[0.02] transition-colors group">
                                    <div className="flex items-start space-x-4">
                                        <div className="relative">
                                            <img draggable="false"
                                                src={mention.author.avatar || "https://avatar.vercel.sh/guest"}
                                                className="w-10 h-10 rounded-full border border-white/10"
                                                alt={mention.author.name}
                                            />
                                            <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-cyan-600 border border-slate-900">
                                                <Zap className="w-2 h-2 text-white" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-sm font-semibold text-white tracking-wide truncate">{mention.author.name}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">@{mention.author.username}</span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground uppercase">{new Date(mention.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="mt-1.5 text-sm text-gray-300 leading-relaxed italic border-l-2 border-cyan-500/20 pl-3">
                                                "{mention.text}"
                                            </p>
                                            <div className="mt-3 flex items-center space-x-4">
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] uppercase font-bold text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10">
                                                    Reply with Agent
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] uppercase font-bold text-slate-500 hover:text-white">
                                                    Ignore
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-12 text-center">
                                    <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                    <p className="text-muted-foreground">No recent mentions found.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Feedback Loop Intelligence */}
                <Card className="bg-slate-900/40 border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Zap className="w-24 h-24 text-cyan-500" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-lg text-white">Agent Insights</CardTitle>
                        <CardDescription>AI-generated feedback based on performance data</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                                <h5 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center mb-2">
                                    <ArrowUpRight className="w-3 h-3 mr-1" />
                                    Optimization Tip
                                </h5>
                                <p className="text-sm text-gray-300 leading-normal">
                                    Your latest post on X has a 12% higher engagement than average. Consider following up with a similar theme for your next episode.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                                <h5 className="text-xs font-bold text-orange-400 uppercase tracking-widest flex items-center mb-2">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    Schedule Alert
                                </h5>
                                <p className="text-sm text-gray-300 leading-normal">
                                    Engagement peaks around 6 PM. Adjusting generation timing to hit this window could increase reach by 20%.
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <h5 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Audience Sentiment</h5>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Positive</span>
                                    <span className="text-green-400">78%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 w-[78%]" />
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Constructive</span>
                                    <span className="text-cyan-400">15%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500 w-[15%]" />
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Negative</span>
                                    <span className="text-red-400">7%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 w-[7%]" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
