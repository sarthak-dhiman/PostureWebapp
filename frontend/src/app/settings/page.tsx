"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldCheck, CreditCard, ExternalLink, Loader2, CheckCircle2 } from "lucide-react"

export default function SettingsPage() {
    const { data: session, status } = useSession({ required: true })
    const [loadingCheckout, setLoadingCheckout] = useState(false)
    const [loadingPortal, setLoadingPortal] = useState(false)

    const user = session?.user as any

    if (status === "loading" || !user) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const handleSubscribe = async () => {
        setLoadingCheckout(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/billing/checkout/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${user?.accessToken || (session as any)?.accessToken}`
                },
                body: JSON.stringify({ price_id: "price_placeholder_for_now" }) // Hardcoded for scaffold
            })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            }
        } catch (error) {
            console.error("Checkout error:", error)
        } finally {
            setLoadingCheckout(false)
        }
    }

    const handleManageBilling = async () => {
        setLoadingPortal(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/billing/portal/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${user?.accessToken || (session as any)?.accessToken}`
                }
            })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            }
        } catch (error) {
            console.error("Portal error:", error)
        } finally {
            setLoadingPortal(false)
        }
    }

    const hasSubscription = user.organization?.hasSubscription

    return (
        <div className="container mx-auto p-6 pt-20 max-w-4xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account and organization billing.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Profile Details */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <ShieldCheck className="w-5 h-5 mr-2 text-primary" />
                            Profile Details
                        </CardTitle>
                        <CardDescription>Your personal account information.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Name</p>
                            <p className="text-base font-semibold text-slate-900">{user.name}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Email</p>
                            <p className="text-base font-semibold text-slate-900">{user.email}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Organization</p>
                            <p className="text-base font-semibold text-slate-900">
                                {user.organization?.name || "None"}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Billing Management */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <CreditCard className="w-5 h-5 mr-2 text-primary" />
                            Billing & Subscription
                        </CardTitle>
                        <CardDescription>Manage your Stripe integration and active plans.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {hasSubscription ? (
                            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4">
                                <div className="flex items-start">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 mr-2" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-emerald-800">Active Subscription</h4>
                                        <p className="text-sm text-emerald-700 mt-1">
                                            Your organization has an active SaaS plan. Your API ingestion is online.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-md bg-slate-50 border border-slate-200 p-4">
                                <h4 className="text-sm font-semibold text-slate-900 mb-1">No Active Plan</h4>
                                <p className="text-sm text-slate-500 mb-4">
                                    Subscribe to enable device telemetry ingestion and the analytics dashboard.
                                </p>
                                <Button
                                    onClick={handleSubscribe}
                                    disabled={loadingCheckout}
                                    className="w-full bg-primary hover:bg-primary/90"
                                >
                                    {loadingCheckout ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Subscribe Now ($50/mo)
                                </Button>
                            </div>
                        )}
                    </CardContent>
                    {hasSubscription && (
                        <CardFooter className="bg-slate-50 border-t border-slate-100 p-4">
                            <Button
                                variant="outline"
                                className="w-full bg-white"
                                onClick={handleManageBilling}
                                disabled={loadingPortal}
                            >
                                {loadingPortal ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-500" />
                                ) : (
                                    <ExternalLink className="w-4 h-4 mr-2 text-slate-500" />
                                )}
                                Manage via Stripe Customer Portal
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </div>
    )
}
