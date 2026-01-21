'use client';

import React from 'react';
import { Database } from "lucide-react";

export default function DataPage() {
    return (
        <div className="flex-1 h-full flex flex-col items-center justify-center space-y-4">
            <div className="p-4 rounded-full bg-slate-900 border border-slate-800">
                <Database className="w-12 h-12 text-slate-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-300">Data Sources</h1>
            <p className="text-slate-500">This module is currently under development.</p>
        </div>
    );
}
