"use client"

import { useState, useEffect } from "react"
import { useSubscription } from "@/hooks/useSubscription"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, ShieldAlert, Loader2, Link as LinkIcon, Plus, Minus, Check, Copy, Camera, MoreVertical, Shield, UserMinus, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { apiFetch, getApiUrl } from "@/lib/api"

export default function DashboardPage() {
    const { sessionStatus, isLoading, hasSubscription, org, isAdmin, user, token, currentPeriodEnd } = useSubscription()
    const router = useRouter()
    const queryClient = useQueryClient()
    const [copiedLink, setCopiedLink] = useState(false)
    const [copiedCode, setCopiedCode] = useState(false)
    const [inviteLink, setInviteLink] = useState('')
    const [newMemberId, setNewMemberId] = useState('')
    const [pendingSeats, setPendingSeats] = useState<number | null>(null)

    // Read session_id from URL on client only
    const [sessionId, setSessionId] = useState<string | null>(null)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        setSessionId(params.get('session_id'))
    }, [])

    // Clear session_id if it exists to clean up URL
    useEffect(() => {
        if (sessionId && sessionStatus === 'authenticated') {
            router.replace('/dashboard')
            setSessionId(null)
        }
    }, [sessionId, sessionStatus, router])

    // Fetch detailed Organization Data for Admin Dashboard (users, invite code, seats)
    const fetchDetailedOrgData = async () => {
        const res = await apiFetch(getApiUrl(`/api/v1/orgs/me`), {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) throw new Error("Failed to fetch organization details")
        return res.json()
    }

    const { data: orgData, isLoading: isLoadingOrg } = useQuery({
        queryKey: ["orgDashboard", org?.id],
        queryFn: fetchDetailedOrgData,
        enabled: !!token && !!isAdmin
    })

    useEffect(() => {
        if (typeof window !== 'undefined' && orgData?.invite_code) {
            setInviteLink(`${window.location.origin}/signup?invite=${orgData.invite_code}`)
        }
    }, [orgData?.invite_code])

    const updateSeatsMutation = useMutation({
        mutationFn: async (newSeats: number) => {
            const res = await apiFetch(getApiUrl(`/api/v1/orgs/me/`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
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
            queryClient.invalidateQueries({ queryKey: ["userProfile"] })
            setPendingSeats(null)
        }
    })

    const manageMemberMutation = useMutation({
        mutationFn: async ({ userId, action }: { userId: string, action: 'promote' | 'demote' | 'remove' }) => {
            const res = await apiFetch(getApiUrl(`/api/v1/orgs/me/members/${userId}/`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ action })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.detail || "Failed to manage member")
            }
            return res.json()
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["orgDashboard"] })
        },
        onError: (err: any) => {
            alert(err.message)
        }
    })

    const addMemberMutation = useMutation({
        mutationFn: async (userIdToAdd: string) => {
            const res = await apiFetch(getApiUrl(`/api/v1/orgs/me/members/add/`), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ user_id: parseInt(userIdToAdd, 10) })
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.detail || "Failed to add member")
            }
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orgDashboard"] })
            setNewMemberId('')
            alert("User successfully added to organization.")
        },
        onError: (err: any) => {
            alert(err.message)
        }
    })

    // Redirect Solo users away from the admin dashboard — always.
    useEffect(() => {
        if (!isLoading && sessionStatus === "authenticated" && !isAdmin) {
            router.push('/profile')
        }
    }, [sessionStatus, isLoading, isAdmin, router])

    if (sessionStatus === "authenticated" && !isAdmin) {
        return null
    }

    if (sessionStatus === "loading" || !user || isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // If organization has no subscription, show locked state
    if (org && !isLoading && !hasSubscription) {
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

    const daysRemaining = currentPeriodEnd ? Math.ceil((new Date(currentPeriodEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null

    const copyInviteLink = () => {
        navigator.clipboard.writeText(inviteLink)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
    }

    const copyInviteCode = () => {
        if (orgData?.invite_code) {
            navigator.clipboard.writeText(orgData.invite_code)
            setCopiedCode(true)
            setTimeout(() => setCopiedCode(false), 2000)
        }
    }

    const changeSeats = (delta: number) => {
        const newTotal = maxSeats + delta
        if (newTotal < activeUsers) {
            alert("Cannot reduce total seats below current active user count.")
            return
        }
        setPendingSeats(newTotal)
    }

    return (
        <div className="container mx-auto p-6 pt-24 space-y-8 animate-in fade-in duration-500 max-w-7xl">
            {/* Modal Overlay */}
            {pendingSeats !== null && (
                <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <CardHeader>
                            <CardTitle className="text-xl">Confirm Capacity Change</CardTitle>
                            <CardDescription>
                                You are changing your organization's seat limit from <span className="font-bold">{maxSeats}</span> to <span className="font-bold">{pendingSeats}</span>.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-sm text-slate-700 bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 shadow-sm">
                                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                <span className="leading-snug">This will immediately update your Stripe workspace and a prorated invoice will be generated. Do you wish to proceed?</span>
                            </div>
                            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                                <Button variant="outline" onClick={() => setPendingSeats(null)} disabled={updateSeatsMutation.isPending} className="font-bold">Cancel</Button>
                                <Button onClick={() => updateSeatsMutation.mutate(pendingSeats)} className="bg-violet-600 hover:bg-violet-700 text-white font-bold" disabled={updateSeatsMutation.isPending}>
                                    {updateSeatsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Confirm Upgrade
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            <div className="flex flex-col md:flex-row items-baseline justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900">Admin Dashboard</h1>
                    <p className="text-lg text-slate-600 mt-2">
                        Managing <span className="font-bold text-violet-600">{org?.name}</span> organization.
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
                        <CardDescription>Share this link or code to let employees join your workspace.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 mb-1">Invite Link</p>
                            <div className="flex bg-slate-100/80 p-1 rounded-lg border border-slate-200">
                                <input
                                    readOnly
                                    value={inviteLink}
                                    className="bg-transparent border-none text-xs w-full px-3 py-2 text-slate-600 font-mono focus:outline-none"
                                />
                                <Button size="sm" variant="secondary" onClick={copyInviteLink} className="shrink-0 bg-white">
                                    {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                                </Button>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-500 mb-1">Direct Invite Code</p>
                            <div className="flex bg-slate-100/80 p-1 rounded-lg border border-slate-200">
                                <input
                                    readOnly
                                    value={orgData?.invite_code || ''}
                                    className="bg-transparent border-none text-xs w-full px-3 py-2 text-slate-900 font-bold font-mono focus:outline-none"
                                />
                                <Button size="sm" variant="secondary" onClick={copyInviteCode} className="shrink-0 bg-white">
                                    {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                                </Button>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-500 mb-1">Direct Add by ID</p>
                            <div className="flex gap-2">
                                <input
                                    placeholder="Enter User ID..."
                                    value={newMemberId}
                                    onChange={(e) => setNewMemberId(e.target.value)}
                                    className="bg-slate-100/80 border border-slate-200 text-xs w-full px-3 py-2 text-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                                />
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        if (newMemberId.trim()) addMemberMutation.mutate(newMemberId)
                                    }}
                                    disabled={addMemberMutation.isPending || !newMemberId.trim()}
                                    className="shrink-0 font-bold bg-violet-600 hover:bg-violet-700 text-white"
                                >
                                    {addMemberMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                    Add
                                </Button>
                            </div>
                        </div>
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

                        {daysRemaining !== null && (
                            <div className="mt-6 flex items-center justify-between bg-violet-50 p-3 rounded-lg border border-violet-100">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-violet-500" />
                                    <span className="text-xs font-bold text-violet-900">Cycle Ends In</span>
                                </div>
                                <span className="text-xs font-black text-violet-700 uppercase tracking-wider">
                                    {daysRemaining <= 0 ? "Resetting Today" : `${daysRemaining} Days`}
                                </span>
                            </div>
                        )}
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
                        <Link href="/dashboard/cctv" className="w-full">
                            <Button variant="outline" className="w-full font-bold shadow-sm">Open Camera Gateway</Button>
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

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900" disabled={manageMemberMutation.isPending}>
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 font-medium">
                                            <DropdownMenuLabel className="text-xs text-slate-500 font-bold uppercase tracking-wider">Manage Member</DropdownMenuLabel>
                                            <DropdownMenuSeparator />

                                            {u.id === user?.id ? (
                                                <DropdownMenuItem disabled className="text-slate-400 cursor-not-allowed">
                                                    You cannot modify yourself
                                                </DropdownMenuItem>
                                            ) : (
                                                <>
                                                    {u.role === 'EMPLOYEE' ? (
                                                        <DropdownMenuItem onClick={() => manageMemberMutation.mutate({ userId: u.id, action: 'promote' })} className="cursor-pointer text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50">
                                                            <Shield className="mr-2 h-4 w-4" />
                                                            Promote to Admin
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem onClick={() => manageMemberMutation.mutate({ userId: u.id, action: 'demote' })} className="cursor-pointer">
                                                            <Users className="mr-2 h-4 w-4" />
                                                            Demote to Employee
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            if (window.confirm(`Are you sure you want to remove ${u.email} from the organization? They will be converted to a solo account.`)) {
                                                                manageMemberMutation.mutate({ userId: u.id, action: 'remove' })
                                                            }
                                                        }}
                                                        className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                                                    >
                                                        <UserMinus className="mr-2 h-4 w-4" />
                                                        Remove from Organization
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
