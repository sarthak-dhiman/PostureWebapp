"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useSubscription } from "@/hooks/useSubscription"
import { useRouter } from "next/navigation"
import { ShieldCheck, User, CreditCard, Clock, Activity, Loader2, LogOut, Settings, Users, Key, Building } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function ProfilePage() {
    const { data: session, status, update } = useSession()
    const { hasSubscription, org: activeOrg, role } = useSubscription()
    const router = useRouter()

    const [inviteCode, setInviteCode] = useState("")
    const [isJoining, setIsJoining] = useState(false)
    const [joinError, setJoinError] = useState("")

    const handleJoinOrg = async () => {
        if (!inviteCode.trim()) return
        setIsJoining(true)
        setJoinError("")

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
            const res = await fetch(`${baseUrl}/api/v1/orgs/join/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(session?.user as any)?.accessToken}`
                },
                body: JSON.stringify({ invite_code: inviteCode.trim() })
            })

            const data = await res.json()
            if (res.ok) {
                // Force a session refresh to pull the new org & role
                await update()
                window.location.reload()
            } else {
                setJoinError(data.error || "Failed to join organization.")
            }
        } catch (err) {
            setJoinError("Network error occurred.")
        } finally {
            setIsJoining(false)
        }
    }

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
        )
    }

    useEffect(() => {
        if (status === "unauthenticated" || (status === "authenticated" && !session?.user)) {
            router.push("/login?callbackUrl=/profile")
        }
    }, [status, session, router])

    if (status === "unauthenticated" || !session?.user) {
        return null
    }

    // Use our custom injected NextAuth session payload for base user data
    const user = session.user as any
    const org = activeOrg || user.organization

    return (
        <div className="min-h-screen bg-slate-50 pt-28 pb-20">
            {/* BG Decorative elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-100/50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">User Profile</h1>
                        <p className="text-slate-500 mt-1">Manage your account details and subscriptions.</p>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="shadow-sm shadow-red-500/20"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* User Details Column */}
                    <div className="md:col-span-1 space-y-8">
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="text-center pb-2">
                                <div className="mx-auto bg-violet-100 text-violet-600 w-24 h-24 rounded-full flex items-center justify-center mb-4 text-3xl font-black uppercase shadow-inner">
                                    {user.name?.charAt(0) || "U"}
                                </div>
                                <CardTitle className="text-xl">{user.name}</CardTitle>
                                <CardDescription className="text-xs">{user.email}</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4 border-t border-slate-100">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">System Role</span>
                                        <Badge variant="outline" className="bg-slate-50">{role || "USER"}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">User ID</span>
                                        <span className="font-mono text-xs text-slate-400">{String(user.id || "").substring(0, 8)}...</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Security</span>
                                        <span className="text-green-600 flex items-center gap-1 font-medium"><ShieldCheck className="w-3 h-3" /> Active</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Subscription & Payment Column */}
                    <div className="md:col-span-2 space-y-8">
                        {user.role === "SOLO" && (
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <div className="flex items-center gap-2 mb-1">
                                        <CreditCard className="w-5 h-5 text-slate-700" />
                                        <CardTitle>Billing & Payment Methods</CardTitle>
                                    </div>
                                    <CardDescription>Manage your Posture OS subscription and payment methods.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {org?.hasSubscription ? (
                                            <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-8 bg-slate-100 rounded flex items-center justify-center border border-slate-200">
                                                        <span className="text-[10px] font-black tracking-widest text-slate-500">VISA</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">Visa ending in •••• 4242</p>
                                                        <p className="text-xs text-slate-500">Expires 12/26</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-slate-500 bg-slate-50">Default</Badge>
                                            </div>
                                        ) : (
                                            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
                                                No default payment methods found.
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-slate-50 border-t border-slate-100 flex justify-end p-4">
                                    <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
                                        Update Billing Details via Stripe
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}

                        {user.role === "SOLO" && (
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Building className="w-5 h-5 text-violet-500" />
                                        <CardTitle>Organization Setup</CardTitle>
                                    </div>
                                    <CardDescription>Upgrade to enterprise or join an existing organization.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Create org CTA */}
                                    <div className="p-6 text-center rounded-xl border border-violet-200 bg-violet-50/30 flex flex-col items-center justify-center">
                                        <div className="bg-violet-100 w-12 h-12 rounded-full flex items-center justify-center mb-3 text-violet-600 shadow-inner border border-violet-200">
                                            <Building className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">Upgrade to Enterprise</h3>
                                        <p className="text-sm text-slate-600 mt-1 mb-4 leading-relaxed">
                                            Launch a tenant organization with centralized CCTV and admin controls.
                                        </p>
                                        <Button size="sm" onClick={() => router.push('/orgs/create')} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold shadow-lg shadow-violet-500/30 px-6">
                                            Create Organization
                                        </Button>
                                    </div>

                                    {/* Divider */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-slate-200" />
                                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">or join one</span>
                                        <div className="flex-1 h-px bg-slate-200" />
                                    </div>

                                    {/* Join org form */}
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-slate-700">Have an invite code?</p>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="xxxx-xxxx-xxxx"
                                                value={inviteCode}
                                                onChange={e => setInviteCode(e.target.value)}
                                                className="font-mono text-sm"
                                            />
                                            <Button variant="outline" onClick={handleJoinOrg} disabled={isJoining || !inviteCode.trim()}>
                                                {isJoining ? "Joining..." : "Join"}
                                            </Button>
                                        </div>
                                        {joinError && <p className="text-xs text-red-600 font-medium">{joinError}</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        )}


                        {user.role !== "SOLO" && (
                            <Card className="shadow-sm border-slate-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-transparent rounded-bl-full pointer-events-none" />

                                <CardHeader>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Activity className="w-5 h-5 text-violet-500" />
                                        <CardTitle>Organization & Billing</CardTitle>
                                    </div>
                                    <CardDescription>Your current subscription tier and organization status.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {org ? (
                                        user.role === "ADMIN" ? (
                                            <>
                                                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Organization Name</p>
                                                        <p className="font-semibold text-slate-900">{org.name}</p>
                                                    </div>
                                                    <Badge variant={org.isActive ? "default" : "secondary"} className={org.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                                                        {org.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                </div>

                                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 shadow-sm flex items-start justify-between">
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Current Plan</p>
                                                        <div className="flex items-center gap-3">
                                                            <p className="font-semibold text-slate-800 text-lg">
                                                                {hasSubscription ? "Posture OS Pro" : "Free Trial / Basic"}
                                                            </p>
                                                            {hasSubscription && (
                                                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 uppercase text-[10px] font-bold tracking-wider">Active</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                                                            <Clock className="w-4 h-4 text-slate-400" />
                                                            Renews automatically.
                                                        </p>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
                                                        <Settings className="w-4 h-4 mr-2" />
                                                        Manage Plan
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="p-8 text-center rounded-xl border border-slate-200 bg-slate-50 shadow-inner flex flex-col items-center justify-center">
                                                <div className="bg-slate-200 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                                                    <Users className="w-6 h-6 text-slate-500" />
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-900">Managed by Organization</h3>
                                                <p className="text-sm text-slate-500 mt-2 max-w-sm">
                                                    You are currently enrolled in <strong>{org.name}</strong>.
                                                    Billing, subscription, and capacity features are managed by your organization administrators.
                                                </p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="p-6 md:p-8 text-center rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50 flex flex-col items-center">
                                            <div className="bg-violet-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                                                <Key className="w-6 h-6 text-violet-600" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900">Join an Organization</h3>
                                            <p className="text-sm text-slate-500 mt-2 mb-6 max-w-sm">
                                                Enter an invite code provided by your administrator to access your team&apos;s workspace and subscription.
                                            </p>

                                            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                                                <Input
                                                    placeholder="Paste invite code here..."
                                                    value={inviteCode}
                                                    onChange={(e) => setInviteCode(e.target.value)}
                                                    className="bg-white border-slate-200"
                                                    disabled={isJoining}
                                                />
                                                <Button
                                                    className="bg-violet-600 hover:bg-violet-700 text-white shadow-md whitespace-nowrap"
                                                    onClick={handleJoinOrg}
                                                    disabled={isJoining || !inviteCode.trim()}
                                                >
                                                    {isJoining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                    Join Now
                                                </Button>
                                            </div>
                                            {joinError && (
                                                <p className="text-red-500 text-sm font-semibold mt-4 bg-red-50 p-2 rounded w-full max-w-sm border border-red-100">
                                                    {joinError}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Payment Methods (Only for Admins) */}
                        {user.role === "ADMIN" && (
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <div className="flex items-center gap-2 mb-1">
                                        <CreditCard className="w-5 h-5 text-slate-700" />
                                        <CardTitle>Payment Methods</CardTitle>
                                    </div>
                                    <CardDescription>Manage cards used for your organization&apos;s subscription.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {org?.hasSubscription ? (
                                            <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-8 bg-slate-100 rounded flex items-center justify-center border border-slate-200">
                                                        <span className="text-[10px] font-black tracking-widest text-slate-500">VISA</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">Visa ending in •••• 4242</p>
                                                        <p className="text-xs text-slate-500">Expires 12/26</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-slate-500 bg-slate-50">Default</Badge>
                                            </div>
                                        ) : (
                                            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
                                                No default payment methods found.
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-slate-50 border-t border-slate-100 flex justify-end p-4">
                                    <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
                                        Update Billing Details via Stripe
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
