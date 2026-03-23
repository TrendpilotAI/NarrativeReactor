'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Palette, Bot, Save, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useModels, LLM_MODELS, IMAGE_MODELS, VIDEO_MODELS } from "@/contexts/ModelContext";

export default function SettingsPage() {
    const [saved, setSaved] = useState(false);
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

    const { llmModel, setLlmModel, imageModel, setImageModel, videoModel, setVideoModel } = useModels();

    // API Keys state
    const [apiKeys, setApiKeys] = useState({
        anthropic: '',
        falai: '',
        openai: '',
        google: '',
        zhipu: '',
    });

    useEffect(() => {
        // Load settings from localStorage on mount
        const storedKeys = localStorage.getItem('nr_api_keys');
        if (storedKeys) {
            try {
                setApiKeys(JSON.parse(storedKeys));
            } catch (e) {
                console.error('Failed to parse stored API keys');
            }
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('nr_api_keys', JSON.stringify(apiKeys));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const toggleShowKey = (key: string) => {
        setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="flex-1 space-y-6 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Settings</h2>
                    <p className="text-muted-foreground">Configure API keys, models, and preferences.</p>
                </div>
                <Button onClick={handleSave} className="bg-cyan-600 hover:bg-cyan-500">
                    {saved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {saved ? 'Saved!' : 'Save Settings'}
                </Button>
            </div>

            <Tabs defaultValue="api-keys" className="space-y-4">
                <TabsList className="bg-card border border-border">
                    <TabsTrigger value="api-keys">
                        <Key className="w-4 h-4 mr-2" /> API Keys
                    </TabsTrigger>
                    <TabsTrigger value="models">
                        <Bot className="w-4 h-4 mr-2" /> AI Models
                    </TabsTrigger>
                    <TabsTrigger value="appearance">
                        <Palette className="w-4 h-4 mr-2" /> Appearance
                    </TabsTrigger>
                </TabsList>

                {/* API Keys Tab */}
                <TabsContent value="api-keys" className="space-y-4">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle>API Keys</CardTitle>
                            <CardDescription>Configure your API keys for AI services. Keys are stored locally in your browser.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {[
                                { key: 'anthropic', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
                                { key: 'falai', label: 'Fal.ai API Key', placeholder: 'fal_...' },
                                { key: 'openai', label: 'OpenAI API Key', placeholder: 'sk-...' },
                                { key: 'google', label: 'Google AI API Key', placeholder: 'AIza...' },
                                { key: 'zhipu', label: 'Zhipu AI API Key (GLM)', placeholder: '...' },
                            ].map(({ key, label, placeholder }) => (
                                <div key={key} className="space-y-2">
                                    <Label htmlFor={key}>{label}</Label>
                                    <div className="relative">
                                        <Input
                                            id={key}
                                            type={showKeys[key] ? 'text' : 'password'}
                                            placeholder={placeholder}
                                            value={apiKeys[key as keyof typeof apiKeys]}
                                            onChange={(e) => setApiKeys(prev => ({ ...prev, [key]: e.target.value }))}
                                            className="pr-10 bg-black/30 border-border"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                            onClick={() => toggleShowKey(key)}
                                        >
                                            {showKeys[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Models Tab */}
                <TabsContent value="models" className="space-y-4">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle>AI Model Preferences</CardTitle>
                            <CardDescription>Choose default models for content generation. Changes apply globally across the application.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Copy Generation Model</Label>
                                <select
                                    className="w-full p-3 rounded-md bg-black/30 border border-border text-white"
                                    value={llmModel.id}
                                    onChange={(e) => {
                                        const model = LLM_MODELS.find(m => m.id === e.target.value);
                                        if (model) setLlmModel(model);
                                    }}
                                >
                                    {LLM_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Image Generation Model</Label>
                                <select
                                    className="w-full p-3 rounded-md bg-black/30 border border-border text-white"
                                    value={imageModel.id}
                                    onChange={(e) => {
                                        const model = IMAGE_MODELS.find(m => m.id === e.target.value);
                                        if (model) setImageModel(model);
                                    }}
                                >
                                    {IMAGE_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Video Generation Model</Label>
                                <select
                                    className="w-full p-3 rounded-md bg-black/30 border border-border text-white"
                                    value={videoModel.id}
                                    onChange={(e) => {
                                        const model = VIDEO_MODELS.find(m => m.id === e.target.value);
                                        if (model) setVideoModel(model);
                                    }}
                                >
                                    {VIDEO_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                                    ))}
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Appearance Tab */}
                <TabsContent value="appearance" className="space-y-4">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
                            <CardDescription>Customize the look and feel of Narrative Reactor.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-border">
                                <div>
                                    <p className="font-medium text-white">Dark Mode</p>
                                    <p className="text-sm text-slate-400">Currently active (system default)</p>
                                </div>
                                <div className="w-12 h-6 bg-cyan-600 rounded-full flex items-center px-1">
                                    <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                                </div>
                            </div>
                            <p className="text-sm text-slate-500">More appearance options coming soon.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
