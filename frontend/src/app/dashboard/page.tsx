"use client"

import { useState, useEffect, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, ShieldAlert, Loader2, Link as LinkIcon, Plus, Minus, Check, Copy, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <DashboardContent />
        </Suspense>
    )
}

function DashboardContent() {
    const { data: session, status, update } = useSession({ required: true })
    const router = useRouter()
    const searchParams = useSearchParams()
    const queryClient = useQueryClient()
    const [copied, setCopied] = useState(false)
    const [sessionRefreshed, setSessionRefreshed] = useState(false)

    // Ensure type casting gets us our custom DjangoUser structure
    const user = session?.user as any
    const isAdmin = user?.role === "ADMIN"

    const fetchOrgData = async () => {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orgs/me/`, {
            headers: { Authorization: `Bearer ${user.accessToken}` }
        })
        if (!res.ok) throw new Error("Failed to fetch")
        return res.json()
    }

    const { data: orgData, isLoading } = useQuery({
        queryKey: ["orgDashboard"],
        queryFn: fetchOrgData,
        enabled: !!user?.accessToken && !!isAdmin
    })

    const updateSeatsMutation = useMutation({
        mutationFn: async (newSeats: number) => {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orgs/me/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${user.accessToken}`
                },
                body: JSON.stringify({ max_seats: newSeats })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.detail || "Failed to update seats")
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orgDashboard"] })
        }
    })

    // If we've just come back from checkout, force a session refresh to pick up the new role
    useEffect(() => {
        const sessionId = searchParams.get('session_id')
        if (sessionId && status === 'authenticated' && !sessionRefreshed) {
            setSessionRefreshed(true)
            update().then(() => {
                // Clean the URL without a full reload
                router.replace('/dashboard')
            })
        }
    }, [searchParams, status, sessionRefreshed, update, router])

    // Handle unauthorized redirect — only if NOT coming from checkout
    useEffect(() => {
        const sessionId = searchParams.get('session_id')
        if (status === "authenticated" && !isAdmin && !sessionId) {
            router.push('/profile')
        }
    }, [status, isAdmin, router, searchParams])

    const hasSessionId = searchParams.get('session_id')
    if (status === "authenticated" && !isAdmin && !hasSessionId) {
        return null
    }

    if (status === "loading" || !user || isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // Check local session OR the fresh orgData from the API
    const hasActiveSubscription = user.organization?.hasSubscription || user.organization?.has_subscription || orgData?.has_subscription;

    // If organization has no subscription, show locked state
    if (user.organization && !isLoading && orgData && !hasActiveSubscription) {
        return (
            <div className="container mx-auto p-6 max-w-4xl pt-24">
                <Card className="border-destructive/50 bg-destructive/5 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto bg-destructive/20 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                            <ShieldAlert className="w-10 h-10 text-destructive" />
                        </div>
                        <CardTitle className="text-3xl font-black text-destructive tracking-tight">Subscription Required</CardTitle>
                        <CardDescription className="text-lg mt-2">
                            Your organization ({user.organization.name}) requires an active billing subscription to unlock the admin dashboard.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center pt-8">
                        <Link href="/pricing?type=enterprise" className="inline-flex items-center justify-center rounded-xl text-lg font-bold transition-all bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 h-14 px-8 shadow-xl shadow-violet-500/30">
                            View Enterprise Pricing
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const activeUsers = orgData?.users?.length || 0
    const maxSeats = orgData?.max_seats || 5
    const [inviteLink, setInviteLink] = useState('')

    useEffect(() => {
        if (typeof window !== 'undefined' && orgData?.invite_code) {
            setInviteLink(`${window.location.origin}/signup?invite=${orgData.invite_code}`)
        }
    }, [orgData?.invite_code])

    const copyInvite = () => {
        navigator.clipboard.writeText(inviteLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const changeSeats = (delta: number) => {
        const newTotal = maxSeats + delta
        if (newTotal < activeUsers) {
            alert("Cannot reduce total seats below current active user count.")
            return
        }
        updateSeatsMutation.mutate(newTotal)
    }

    return (
        <div className="container mx-auto p-6 pt-24 space-y-8 animate-in fade-in duration-500 max-w-7xl">
            <div className="flex flex-col md:flex-row items-baseline justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900">Admin Dashboard</h1>
                    <p className="text-lg text-slate-600 mt-2">
                        Managing <span className="font-bold text-violet-600">{orgData?.name}</span> organization.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Invite Card */}
                <Card className="shadow-lg border-slate-200 overflow-hidden">
                    <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <LinkIcon className="w-5 h-5 text-emerald-500" />
                            Invite Your Team
                        </CardTitle>
                        <CardDescription>Share this link to let employees join your workspace.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex bg-slate-100/80 p-1 rounded-lg border border-slate-200">
                            <input
                                readOnly
                                value={inviteLink}
                                className="bg-transparent border-none text-xs w-full px-3 py-2 text-slate-600 font-mono focus:outline-none"
                            />
                            <Button size="sm" variant="secondary" onClick={copyInvite} className="shrink-0 bg-white">
                                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3 text-center">
                            Or share Code: <span className="font-mono font-bold text-slate-900">{orgData?.invite_code}</span>
                        </p>
                    </CardContent>
                </Card>

                {/* Subscription / Seats Card */}
                <Card className="shadow-lg border-slate-200 overflow-hidden">
                    <div className="h-2 w-full bg-gradient-to-r from-violet-500 to-indigo-600" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Users className="w-5 h-5 text-violet-500" />
                            Seat Management
                        </CardTitle>
                        <CardDescription>Manage your organization's subscription capacity.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <p className="text-3xl font-black text-slate-900">{activeUsers} <span className="text-lg text-slate-400 font-medium tracking-normal">/ {maxSeats}</span></p>
                                <p className="text-xs text-slate-500 font-medium">Seats Utilized</p>
                            </div>
                            <div className="w-16 h-16 rounded-full border-4 border-violet-100 flex items-center justify-center relative">
                                <svg className="w-full h-full absolute -rotate-90">
                                    <circle cx="28" cy="28" r="26" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-violet-600" strokeDasharray="163" strokeDashoffset={163 - (163 * (activeUsers / maxSeats))} />
                                </svg>
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                            <span className="text-sm font-medium text-slate-700">Adjust Capacity Limit</span>
                            <div className="flex items-center gap-2">
                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => changeSeats(-1)} disabled={updateSeatsMutation.isPending || maxSeats <= activeUsers}>
                                    <Minus className="w-4 h-4" />
                                </Button>
                                <span className="font-mono font-bold w-6 text-center">{maxSeats}</span>
                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => changeSeats(1)} disabled={updateSeatsMutation.isPending}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* CCTV Room Card */}
                <Card className="shadow-lg border-slate-200 overflow-hidden">
                    <div className="h-2 w-full bg-gradient-to-r from-rose-400 to-orange-500" />
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Camera className="w-5 h-5 text-rose-500" />
                            CCTV Room Integration
                        </CardTitle>
                        <CardDescription>Configure physical monitoring edge nodes.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-full flex flex-col justify-between">
                        <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-sm font-bold text-rose-900">0 Active Cameras</span>
                            </div>
                            <p className="text-xs text-rose-700 mt-2">No hardware nodes detected.</p>
                        </div>
                        <Link href="/cctv" className="w-full">
                            <Button variant="outline" className="w-full font-bold">Open Camera Gateway</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            {/* Active Users Table */}
            <Card className="shadow-lg border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100">
                    <CardTitle className="text-xl font-bold text-slate-900">Active Employees</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        {orgData?.users?.map((u: any) => (
                            <div key={u.id} className="flex items-center justify-between p-4 px-6 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 border border-violet-200 flex items-center justify-center font-bold text-violet-700">
                                        {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">{u.first_name} {u.last_name} <span className="hidden sm:inline-block font-normal text-slate-500 ml-1">({u.username})</span></p>
                                        <p className="text-xs text-slate-500">{u.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {u.role}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
