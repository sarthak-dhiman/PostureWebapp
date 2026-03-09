"use client"

import { useState, useEffect } from "react"
import { useSubscription } from "@/hooks/useSubscription"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    ShieldCheck, CreditCard, ExternalLink, Loader2, CheckCircle2,
    Building2, UserCircle, Zap, AlertCircle, ArrowRight, BadgeCheck
} from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api"

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    SOLO: { label: "Solo User", color: "bg-blue-100 text-blue-700 border-blue-200" },
    ADMIN: { label: "Org Admin", color: "bg-violet-100 text-violet-700 border-violet-200" },
    EMPLOYEE: { label: "Employee", color: "bg-slate-100 text-slate-700 border-slate-200" },
    VIEWER: { label: "Viewer", color: "bg-slate-100 text-slate-600 border-slate-200" },
}

export default function SettingsPage() {
    const { sessionStatus, isLoading, hasSubscription, org, isAdmin, isSolo, user, role, token } = useSubscription()
    const router = useRouter()
    const [loadingCheckout, setLoadingCheckout] = useState(false)
    const [loadingPortal, setLoadingPortal] = useState(false)
    const [portalError, setPortalError] = useState("")
    const [checkoutError, setCheckoutError] = useState("")

    const handleSubscribe = async (planId: string) => {
        setLoadingCheckout(true)
        setCheckoutError("")
        try {
            const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/billing/checkout/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ plan_id: planId })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || data.error || "Checkout failed")
            if (data.subscription_id) {
                // Settings page fallback for admin subscribe button
                const options = {
                    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
                    subscription_id: data.subscription_id,
                    name: "Posture OS",
                    description: "Business Subscription",
                    image: "/icon.png",
                    handler: function (response: any) {
                        window.location.reload()
                    },
                    prefill: { name: user?.name || "", email: user?.email || "" },
                    theme: { color: "#7c3aed" },
                }
                const rzp = new (window as any).Razorpay(options)
                rzp.open()
            }
        } catch (err: any) {
            setCheckoutError(err.message)
        } finally {
            setLoadingCheckout(false)
        }
    }

    const handleManageBilling = async () => {
        setLoadingPortal(true)
        setPortalError("")
        try {
            const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/billing/customer-portal/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.detail || data.error || "Portal failed")
            if (data.url) window.location.href = data.url
        } catch (err: any) {
            setPortalError(err.message)
        } finally {
            setLoadingPortal(false)
        }
    }

    if (isLoading || sessionStatus === "loading" || !user) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
        )
    }

    const roleLabel = ROLE_LABELS[role] || ROLE_LABELS.SOLO
    const orgName = org?.name

    return (
        <div className="min-h-screen bg-slate-50 pt-24 pb-20">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">

                <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Settings</h1>
                    <p className="text-slate-500 mt-1">Manage your account, role, and subscription.</p>
                </div>

                {/* Profile Card */}
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <UserCircle className="w-5 h-5 text-violet-600" />
                            Account Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Name</p>
                            <p className="text-base font-semibold text-slate-900">{user.name || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email</p>
                            <p className="text-base font-semibold text-slate-900">{user.email || "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Role</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleLabel.color}`}>
                                {roleLabel.label}
                            </span>
                        </div>
                        {orgName && (
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Organization</p>
                                <p className="text-base font-semibold text-slate-900 flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-slate-400" />
                                    {orgName}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Billing Card */}
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-indigo-500" />
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <CreditCard className="w-5 h-5 text-violet-600" />
                            Billing & Subscription
                        </CardTitle>
                        <CardDescription>
                            {isAdmin ? "Manage your organization's active plan." : "Subscribe to unlock enterprise features."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoading ? (
                            <div className="flex items-center gap-2 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading subscription status...
                            </div>
                        ) : isAdmin && hasSubscription ? (
                            /* Active subscription */
                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="text-sm font-bold text-emerald-800">Enterprise Plan — Active</h4>
                                    <p className="text-sm text-emerald-700 mt-1">
                                        Your organization has an active subscription. CCTV edge node ingestion and analytics dashboard are enabled.
                                    </p>
                                    {org?.razorpay_subscription_id && (
                                        <p className="text-xs font-mono text-emerald-600/80 mt-1">
                                            Sub ID: {org?.razorpay_subscription_id}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : isAdmin && !hasSubscription ? (
                            /* Admin, no subscription yet */
                            <div className="space-y-4">
                                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-800">No Active Subscription</h4>
                                        <p className="text-sm text-amber-700 mt-1">
                                            Your organization "{orgName}" is set up but doesn't have an active plan. Subscribe to enable CCTV ingestion and the analytics dashboard.
                                        </p>
                                    </div>
                                </div>
                                {checkoutError && <p className="text-sm text-red-600 font-medium">{checkoutError}</p>}
                                <Button
                                    onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_RAZORPAY_PLAN_BUSINESS || "plan_mock_business_mo")}
                                    disabled={loadingCheckout}
                                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold h-11 rounded-xl hover:opacity-90 shadow-lg shadow-violet-500/20"
                                >
                                    {loadingCheckout
                                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                                        : <><Zap className="w-4 h-4 mr-2" /> Subscribe — Business Starter ($100/mo)</>}
                                </Button>
                                <p className="text-xs text-center text-slate-400">
                                    Need a custom Enterprise plan?{" "}
                                    <a href="mailto:sales@posturehub.com" className="text-violet-600 hover:underline font-medium">Contact sales →</a>
                                </p>
                            </div>
                        ) : isSolo ? (
                            /* Solo user — show upgrade path */
                            <div className="space-y-5">
                                <div className="rounded-xl bg-slate-100 border border-slate-200 p-4">
                                    <h4 className="text-sm font-bold text-slate-900 mb-1">Free Solo Plan</h4>
                                    <p className="text-sm text-slate-500">
                                        You're on the free solo plan with access to posture monitoring and health scans for personal use.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Link href="/pricing?type=solo">
                                        <Button variant="outline" className="w-full h-10 border-slate-300 font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">
                                            <BadgeCheck className="w-4 h-4 mr-2" />
                                            Solo Plans
                                        </Button>
                                    </Link>
                                    <Link href="/orgs/create">
                                        <Button className="w-full h-10 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold hover:opacity-90">
                                            <Building2 className="w-4 h-4 mr-2" />
                                            Upgrade to Enterprise
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            /* Employee / Viewer */
                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-500">
                                Your subscription is managed by your organization administrator.
                                Contact them to make billing changes.
                            </div>
                        )}
                    </CardContent>

                    {/* Razorpay portal CTA for active subscribers */}
                    {isAdmin && hasSubscription && (
                        <CardFooter className="bg-slate-50 border-t border-slate-100 p-4 flex-col items-start gap-2">
                            {portalError && <p className="text-sm text-red-600 font-medium">{portalError}</p>}
                            <Button
                                variant="outline"
                                className="w-full bg-white font-semibold"
                                onClick={handleManageBilling}
                                disabled={loadingPortal}
                            >
                                {loadingPortal
                                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-500" />
                                    : <ExternalLink className="w-4 h-4 mr-2 text-slate-500" />}
                                Manage via Razorpay Customer Portal
                            </Button>
                        </CardFooter>
                    )}
                </Card>

                {/* Enterprise dashboard shortcut for admins */}
                {isAdmin && (
                    <Card className="border-violet-200 bg-violet-50 shadow-sm">
                        <CardContent className="flex items-center justify-between py-5 px-6">
                            <div>
                                <p className="font-bold text-violet-900">Organization Dashboard</p>
                                <p className="text-sm text-violet-700 mt-0.5">Manage members, CCTV nodes, and seat limits.</p>
                            </div>
                            <Link href="/dashboard">
                                <Button className="bg-violet-600 hover:bg-violet-700 text-white font-bold shrink-0">
                                    Open Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
