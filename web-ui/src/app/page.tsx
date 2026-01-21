'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContentCard, type ContentItem } from "@/components/content-card";
import { Activity, Clock, Zap, TrendingUp, CheckCircle2, FileText, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  // Mock data for dashboard
  const metrics = [
    { title: "Content In Production", value: "12", icon: Zap, color: "text-amber-400" },
    { title: "Pending Approval", value: "4", icon: Clock, color: "text-orange-400" },
    { title: "Brand Compliance", value: "98%", icon: CheckCircle2, color: "text-green-400" },
    { title: "Avg. Velocity", value: "11s", icon: TrendingUp, color: "text-cyan-400" },
  ];

  const recentContent: ContentItem[] = [
    {
      id: "1",
      type: "twitter",
      title: "Episode 3.1 Teaser",
      content: "Three weeks of research. Or 11 seconds. \n\nMaya asked one question. Signal Studio delivered a complete analysis—with sources, reasoning, and audit trail.\n\nThe gap between knowing and proving? It just closed.\n\n#DecisionVelocity #WealthManagement #AIForFinance",
      status: "pending_approval",
      complianceScore: 92,
      complianceReasons: ["Good use of keywords", "Tone matches brand voice"],
      lastUpdated: new Date().toISOString()
    },
    {
      id: "2",
      type: "image-prompt",
      title: "Maya Office Scene",
      content: "Close-up of professional woman's hands typing on keyboard, Signal Studio interface visible on screen with cyan glow, morning sunlight creating lens flare, shallow depth of field, cinematic, 8K",
      status: "approved",
      complianceScore: 100,
      complianceReasons: ["Perfect color palette match", "Signature element included"],
      lastUpdated: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "3",
      type: "linkedin",
      title: "The Future of Work",
      content: "Everyone asks if AI is going to replace knowledge workers.\n\nThat's the wrong question.\n\nThe right question is: What happens when knowledge workers have AI that actually works WITH them?",
      status: "draft",
      complianceScore: 78,
      complianceReasons: ["Slightly informal tone", "Missing specific product mention"],
      lastUpdated: new Date(Date.now() - 3600000).toISOString()
    }
  ];

  return (
    <div className="flex-1 space-y-6 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-white">Campaign Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-cyan-950/30 text-cyan-400 border-cyan-800">
            Waitlist: Active
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, i) => (
          <Card key={i} className="bg-card border-border text-card-foreground shadow-lg hover:border-cyan-500/30 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 bg-card border-border text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {recentContent.map((item) => (
                  <div key={item.id} className="h-full">
                    <ContentCard item={item} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="col-span-3 bg-card border-border text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentContent.filter(i => i.status === 'pending_approval' || i.score < 80).map((item, i) => (
                <div key={i} className="flex items-start space-x-3 p-3 rounded-md bg-slate-950/30 border border-border hover:bg-slate-900 hover:border-cyan-500/30 transition-all duration-200 cursor-pointer">
                  <div className="mt-1">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none text-slate-200">{item.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{item.content}</p>
                    <div className="flex items-center pt-1">
                      <Badge variant="outline" className="text-[10px] h-5 py-0 px-1 border-amber-500/30 text-amber-500">
                        Action Required
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
