'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, Image, Video, RefreshCw, Trash2, Download, X, Play } from "lucide-react";
import { listAssetsAction, deleteAssetAction } from "../actions";
import { motion, AnimatePresence } from 'framer-motion';

interface MediaAsset {
    id: string;
    type: 'image' | 'video';
    url: string;
    prompt?: string;
    modelId?: string;
    cost?: number;
    duration?: number;
    createdAt: string;
}

export default function AssetsPage() {
    const [assets, setAssets] = useState<MediaAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
    const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);

    useEffect(() => {
        fetchAssets();
    }, [filter]);

    const fetchAssets = async () => {
        setIsLoading(true);
        try {
            const data = await listAssetsAction(filter);
            setAssets(data || []);
        } catch (error) {
            console.error('Failed to fetch assets', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this asset?')) {
            try {
                await deleteAssetAction(id);
                setAssets(assets.filter(a => a.id !== id));
                if (selectedAsset?.id === id) setSelectedAsset(null);
            } catch (error) {
                console.error('Failed to delete asset', error);
            }
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const formatCost = (cost?: number) => {
        return cost ? `$${cost.toFixed(4)}` : '-';
    };

    return (
        <div className="flex-1 space-y-6 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Media Assets</h2>
                    <p className="text-muted-foreground">All generated images and videos are stored here.</p>
                </div>
                <Button variant="outline" onClick={fetchAssets} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'image' | 'video')} className="space-y-4">
                <TabsList className="bg-card border border-border">
                    <TabsTrigger value="all">All ({assets.length})</TabsTrigger>
                    <TabsTrigger value="image">
                        <Image className="w-4 h-4 mr-2" /> Images
                    </TabsTrigger>
                    <TabsTrigger value="video">
                        <Video className="w-4 h-4 mr-2" /> Videos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={filter} className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <RefreshCw className="w-10 h-10 text-cyan-500 animate-spin" />
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
                            <div className="p-4 rounded-full bg-slate-900 border border-slate-800">
                                <Layers className="w-12 h-12 text-slate-500" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-300">No Assets Yet</h3>
                            <p className="text-slate-500 max-w-md">
                                Generated images and videos will appear here. Use the Agent Chat to generate content!
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {assets.map((asset) => (
                                <Card
                                    key={asset.id}
                                    className="bg-card border-border overflow-hidden cursor-pointer hover:border-cyan-500/30 transition-all group"
                                    onClick={() => setSelectedAsset(asset)}
                                >
                                    <div className="relative aspect-video bg-black/50">
                                        {asset.type === 'image' ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={asset.url}
                                                alt={asset.prompt || 'Generated image'}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="relative w-full h-full">
                                                <video
                                                    src={asset.url}
                                                    className="w-full h-full object-cover"
                                                    preload="metadata"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                    <Play className="w-10 h-10 text-white opacity-80" />
                                                </div>
                                            </div>
                                        )}
                                        <Badge
                                            className={`absolute top-2 left-2 ${asset.type === 'image' ? 'bg-blue-500/80' : 'bg-purple-500/80'}`}
                                        >
                                            {asset.type}
                                        </Badge>
                                    </div>
                                    <CardContent className="p-3 space-y-1">
                                        <p className="text-xs text-slate-400 line-clamp-2" title={asset.prompt}>
                                            {asset.prompt || 'No prompt available'}
                                        </p>
                                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                                            <span>{formatDate(asset.createdAt)}</span>
                                            <span>{formatCost(asset.cost)}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedAsset && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                        onClick={() => setSelectedAsset(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            className="bg-slate-950 border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-border">
                                <div className="flex items-center space-x-3">
                                    <Badge className={selectedAsset.type === 'image' ? 'bg-blue-500' : 'bg-purple-500'}>
                                        {selectedAsset.type}
                                    </Badge>
                                    <span className="text-sm text-slate-400">{formatDate(selectedAsset.createdAt)}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <a href={selectedAsset.url} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm">
                                            <Download className="w-4 h-4 mr-2" /> Download
                                        </Button>
                                    </a>
                                    <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(selectedAsset.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedAsset(null)}>
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                            <ScrollArea className="max-h-[70vh]">
                                <div className="p-4 space-y-4">
                                    {selectedAsset.type === 'image' ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={selectedAsset.url}
                                            alt={selectedAsset.prompt || 'Generated image'}
                                            className="w-full rounded-lg"
                                        />
                                    ) : (
                                        <video
                                            src={selectedAsset.url}
                                            controls
                                            className="w-full rounded-lg"
                                            autoPlay
                                        />
                                    )}
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold text-slate-300">Prompt</h4>
                                        <p className="text-sm text-slate-400 bg-black/30 p-3 rounded-lg">
                                            {selectedAsset.prompt || 'No prompt available'}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-slate-500">Model</p>
                                            <p className="text-slate-300 font-mono text-xs">{selectedAsset.modelId || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Cost</p>
                                            <p className="text-slate-300">{formatCost(selectedAsset.cost)}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500">Duration</p>
                                            <p className="text-slate-300">{selectedAsset.duration ? `${selectedAsset.duration.toFixed(1)}s` : '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
