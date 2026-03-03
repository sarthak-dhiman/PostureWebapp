"use client"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { CreditCard, CheckCircle2, AlertTriangle, ExternalLink, Check } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function BillingPage() {
    const { data: session, status } = useSession({ required: true })
    const user = session?.user as any

    if (status === "loading" || !user) {
        return <div className="p-8 text-muted-foreground animate-pulse">Loading subscription data...</div>
    }

    const org = user.organization
    const hasActiveSub = org?.hasSubscription

    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Billing & Subscription</h1>
                    <p className="text-muted-foreground">
                        Manage your enterprise tier for {org?.name || "your workspace"}.
                    </p>
                </div>
                <Link href="/dashboard">
                    <Button variant="outline">&larr; Back to Dashboard</Button>
                </Link>
            </div>

            <Card className={hasActiveSub ? "border-green-200" : "border-amber-200"}>
                <CardHeader className={hasActiveSub ? "bg-green-50/50" : "bg-amber-50/50"}>
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full ${hasActiveSub ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {hasActiveSub ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                        </div>
                        <div>
                            <CardTitle className="text-xl">
                                {hasActiveSub ? "Active Enterprise Subscription" : "Subscription Inactive"}
                            </CardTitle>
                            <CardDescription className="mt-1 text-sm text-slate-600">
                                {hasActiveSub
                                    ? "Your workspace is fully unlocked and edge telemetry is active."
                                    : "Posture tracking and Dashboard analytics are currently locked. Please add a payment method."}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-2">Current Plan: {hasActiveSub ? "Pro Tier" : "Free Restricted"}</h3>
                            <ul className="space-y-4 text-sm text-slate-600">
                                <li className="flex items-center gap-3">
                                    <div className="bg-emerald-100 p-1 rounded-full"><Check className="w-3 h-3 text-emerald-600" /></div>
                                    Unlimited PySide6 Edge Nodes
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="bg-emerald-100 p-1 rounded-full"><Check className="w-3 h-3 text-emerald-600" /></div>
                                    30-Day Telemetry Retention
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="bg-emerald-100 p-1 rounded-full"><Check className="w-3 h-3 text-emerald-600" /></div>
                                    Core API Access
                                </li>
                            </ul>
                        </div>
                        <div className="flex flex-col items-start md:items-end justify-center">
                            {/* In a real app, this would be a Stripe Portal redirect */}
                            <Button className="w-full md:w-auto gap-2">
                                <CreditCard className="w-4 h-4" />
                                {hasActiveSub ? "Manage Customer Portal" : "Upgrade via Stripe"}
                                <ExternalLink className="w-3 h-3 opacity-50 ml-1" />
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2 md:text-right w-full">
                                Securely powered by Stripe Payments.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
