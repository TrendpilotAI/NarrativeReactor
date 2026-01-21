'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Twitter, Link2, RefreshCw } from "lucide-react";
import { listIntegrationsAction, getAuthUrlAction } from "../actions";

export default function IntegrationsPage() {
    const [integrations, setIntegrations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const searchParams = useSearchParams();
    const status = searchParams.get('status');

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const fetchIntegrations = async () => {
        try {
            const data = await listIntegrationsAction();
            setIntegrations(data || []);
        } catch (error) {
            console.error('Failed to fetch integrations', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnect = async (provider: string) => {
        try {
            const result = await getAuthUrlAction(provider);
            if (result?.url) {
                // Store verifier for the callback
                localStorage.setItem(`verifier_${provider}`, result.codeVerifier);
                window.location.href = result.url;
            }
        } catch (error) {
            alert('Failed to initiate connection');
        }
    };

    return (
        <div className="flex-1 space-y-6 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white">Integrations</h2>
                    <p className="text-muted-foreground">Connect your social accounts to enable the Narrative Reactor agent to post and track performance.</p>
                </div>
            </div>

            {status === 'success' && (
                <div className="bg-green-500/10 border border-green-500/50 p-4 rounded-xl flex items-center space-x-3">
                    <CheckCircle2 className="text-green-500 w-5 h-5" />
                    <p className="text-sm text-green-200">Account connected successfully!</p>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full flex justify-center py-12">
                        <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
                    </div>
                ) : (
                    integrations.map((integration) => (
                        <Card key={integration.provider} className="bg-card border-border hover:border-cyan-500/30 transition-all shadow-lg">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-slate-800 rounded-lg">
                                        {integration.provider === 'x' ? <Twitter className="w-6 h-6 text-[#1DA1F2]" /> : <Link2 className="w-6 h-6 text-slate-400" />}
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-bold">{integration.name}</CardTitle>
                                        <CardDescription>{integration.connected ? `@${integration.username}` : 'Not connected'}</CardDescription>
                                    </div>
                                </div>
                                <Badge variant={integration.connected ? 'default' : 'secondary'} className={integration.connected ? 'bg-green-500/20 text-green-400 border-green-500/20' : ''}>
                                    {integration.connected ? 'Active' : 'Disconnected'}
                                </Badge>
                            </CardHeader>
                            <CardContent className="pt-4">
                                {integration.connected ? (
                                    <Button variant="outline" className="w-full border-red-500/20 text-red-400 hover:bg-red-500/10" onClick={() => { }}>
                                        Disconnect Account
                                    </Button>
                                ) : (
                                    <Button className="w-full bg-cyan-600 hover:bg-cyan-500" onClick={() => handleConnect(integration.provider)}>
                                        Connect {integration.name}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
