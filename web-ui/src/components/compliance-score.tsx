import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface ComplianceScoreProps {
    score: number; // 0 to 100
    reasons: string[];
}

export function ComplianceScore({ score, reasons }: ComplianceScoreProps) {
    let color = "bg-red-500";
    let Icon = XCircle;
    let label = "Non-Compliant";

    if (score >= 90) {
        color = "bg-green-500";
        Icon = CheckCircle2;
        label = "Compliant";
    } else if (score >= 70) {
        color = "bg-yellow-500";
        Icon = AlertTriangle;
        label = "Review Needed";
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <div className="flex items-center space-x-2 cursor-help">
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${color}/20 text-${color === 'bg-green-500' ? 'green' : color === 'bg-yellow-500' ? 'yellow' : 'red'}-400 border border-${color}/30`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-bold">{score}%</span>
                        </div>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{label}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-900 border-slate-700 max-w-xs">
                    <p className="font-semibold mb-1">Compliance Analysis:</p>
                    <ul className="text-xs list-disc pl-4 space-y-1">
                        {reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                        ))}
                    </ul>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
