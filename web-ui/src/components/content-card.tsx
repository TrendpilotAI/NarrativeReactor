import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComplianceScore } from "./compliance-score";
import { Edit2, Send, RotateCcw, CheckCircle2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type ContentType = 'twitter' | 'linkedin' | 'threads' | 'image-prompt';
export type ContentStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected';

export interface ContentItem {
    id: string;
    type: ContentType;
    title: string;
    content: string; // The text body or prompt
    status: ContentStatus;
    complianceScore: number;
    complianceReasons: string[];
    lastUpdated: string;
}

interface ContentCardProps {
    item: ContentItem;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    onEdit?: (id: string) => void;
}

export function ContentCard({ item, onApprove, onReject, onEdit }: ContentCardProps) {
    const getBadgeColor = (status: ContentStatus) => {
        switch (status) {
            case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'published': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'pending_approval': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getTypeIcon = (type: ContentType) => {
        switch (type) {
            case 'twitter': return '🐦';
            case 'linkedin': return '💼';
            case 'threads': return '🧵';
            case 'image-prompt': return '🎨';
        }
    };

    return (
        <Card className="bg-card border-border text-card-foreground overflow-hidden h-full flex flex-col hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center space-x-2">
                    <span className="text-xl">{getTypeIcon(item.type)}</span>
                    <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-cyan-400 transition-colors">{item.title}</CardTitle>
                </div>
                <Badge variant="outline" className={`capitalize ${getBadgeColor(item.status)}`}>
                    {item.status.replace('_', ' ')}
                </Badge>
            </CardHeader>
            <CardContent className="flex-grow py-4">
                <div className="text-sm text-muted-foreground font-mono whitespace-pre-wrap bg-black/20 p-4 rounded-md border border-border/50 min-h-[100px] shadow-inner relative group/content">
                    <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p: ({ ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                                a: ({ ...props }) => <a {...props} className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer" />,
                                img: ({ ...props }) => (
                                    <div className="my-2 rounded-lg overflow-hidden border border-border/50">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img {...props} className="w-full max-h-[200px] object-cover" alt={props.alt || 'Content Image'} />
                                    </div>
                                ),
                            }}
                        >
                            {item.content}
                        </ReactMarkdown>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover/content:opacity-100 transition-opacity bg-black/50 hover:bg-black/80"
                        title="Copy content"
                        onClick={() => {
                            if (typeof navigator !== 'undefined') {
                                navigator.clipboard.writeText(item.content);
                            }
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                    </Button>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3 pt-2 bg-black/10">
                <div className="w-full flex items-center justify-between border-b border-border pb-3">
                    <span className="text-xs text-slate-500">Updated: {new Date(item.lastUpdated).toLocaleDateString()}</span>
                    <ComplianceScore score={item.complianceScore} reasons={item.complianceReasons} />
                </div>

                <div className="flex w-full space-x-2">
                    {item.status !== 'approved' && item.status !== 'published' && (
                        <>
                            <Button variant="outline" size="sm" className="flex-1 bg-slate-800 border-slate-700 hover:bg-slate-700" onClick={() => onEdit?.(item.id)}>
                                <Edit2 className="w-3 h-3 mr-2" /> Edit
                            </Button>
                            <Button variant="default" size="sm" className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => onApprove?.(item.id)}>
                                <CheckCircle2 className="w-3 h-3 mr-2" /> Approve
                            </Button>
                        </>
                    )}
                    {(item.status === 'approved' || item.status === 'published') && (
                        <Button variant="outline" size="sm" className="w-full border-slate-700 text-slate-400" disabled>
                            <CheckCircle2 className="w-3 h-3 mr-2" /> {item.status === 'published' ? 'Published' : 'Ready to Publish'}
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}
