"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Building, Users, Shield, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function CreateOrgPage() {
    const { data: session, status, update } = useSession({ required: true })
    const router = useRouter()

    const [orgName, setOrgName] = useState("")
    const [initialSeats, setInitialSeats] = useState(5)
    const [invitePolicy, setInvitePolicy] = useState("OPEN_LINK")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
        )
    }

    const user = session?.user as any

    // Redirect away from this page if user is not SOLO (already upgraded)
    useEffect(() => {
        if (user && user.role !== "SOLO") {
            router.push("/dashboard")
        }
    }, [user, router])

    if (user && user.role !== "SOLO") return null

    const handleUpgrade = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
            const res = await fetch(`${baseUrl}/api/v1/orgs/upgrade/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user?.accessToken || (session as any)?.user?.accessToken}`
                },
                body: JSON.stringify({
                    org_name: orgName,
                    invite_policy: invitePolicy,
                    initial_seats: initialSeats
                })
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || data.detail || "Failed to upgrade organization")
            }

            // Force session refresh with new role and org
            await update({
                role: data.organization.role,
                organization: {
                    id: data.organization.id,
                    name: data.organization.name,
                    isActive: false,
                    hasSubscription: false
                }
            })

            // Redirect to admin dashboard
            router.push("/dashboard")

        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-28 pb-20">
            {/* BG Decorative elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-100/50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2" />

            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

                <div className="text-center max-w-xl mx-auto mb-10">
                    <div className="bg-violet-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Building className="w-8 h-8 text-violet-600" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Upgrade to Enterprise</h1>
                    <p className="text-slate-500 mt-4 text-lg">
                        Configure your organization to unlock centralized monitoring, bulk user management, and dedicated CCTV edge nodes.
                    </p>
                </div>

                <Card className="shadow-xl border-slate-200 overflow-hidden">
                    <div className="h-2 w-full bg-gradient-to-r from-violet-500 to-indigo-600" />
                    <CardHeader className="bg-white pb-6 border-b border-slate-100">
                        <CardTitle className="text-2xl">Organization Setup</CardTitle>
                        <CardDescription>
                            Your account will be elevated to the <strong className="text-slate-900">ADMIN</strong> role automatically.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-8 pt-8">
                        <form onSubmit={handleUpgrade} className="space-y-8">

                            {/* Org Name */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900">Organization Name</label>
                                <p className="text-xs text-slate-500 mb-2">This is the tenant name under which your data will be isolated.</p>
                                <Input
                                    required
                                    placeholder="e.g. Acme Corporation"
                                    value={orgName}
                                    onChange={(e) => setOrgName(e.target.value)}
                                    className="h-12 text-base shadow-sm"
                                />
                            </div>

                            <hr className="border-slate-100" />

                            {/* Capacity */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-violet-600" /> Initial Seat Capacity
                                </label>
                                <p className="text-xs text-slate-500 mb-4">How many employees do you anticipate onboarding initially? You can adjust this later.</p>

                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1" max="100"
                                        value={initialSeats}
                                        onChange={(e) => setInitialSeats(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                                    />
                                    <div className="bg-slate-100 px-4 py-2 rounded-lg font-mono font-bold text-lg min-w-[4rem] text-center border border-slate-200 shadow-inner">
                                        {initialSeats}
                                    </div>
                                </div>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Invite Policy */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-violet-600" /> Invite Policy
                                </label>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className={`relative flex cursor-pointer rounded-xl border-2 p-4 shadow-sm transition-all overflow-hidden ${invitePolicy === 'OPEN_LINK' ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                                        <div className={`absolute top-0 right-0 w-8 h-8 rounded-bl-xl flex items-center justify-center ${invitePolicy === 'OPEN_LINK' ? 'bg-violet-500' : 'hidden'}`}>
                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                        </div>
                                        <input type="radio" className="sr-only" checked={invitePolicy === 'OPEN_LINK'} onChange={() => setInvitePolicy('OPEN_LINK')} />
                                        <div>
                                            <p className="font-bold text-slate-900 mb-1">Open Link</p>
                                            <p className="text-xs text-slate-500 leading-relaxed">Anyone with your organization's unique invite link automatically joins the tenant as an Employee.</p>
                                        </div>
                                    </label>

                                    <label className={`relative flex cursor-pointer rounded-xl border-2 p-4 shadow-sm transition-all overflow-hidden ${invitePolicy === 'APPROVAL_REQUIRED' ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                                        <div className={`absolute top-0 right-0 w-8 h-8 rounded-bl-xl flex items-center justify-center ${invitePolicy === 'APPROVAL_REQUIRED' ? 'bg-violet-500' : 'hidden'}`}>
                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                        </div>
                                        <input type="radio" className="sr-only" checked={invitePolicy === 'APPROVAL_REQUIRED'} onChange={() => setInvitePolicy('APPROVAL_REQUIRED')} />
                                        <div>
                                            <p className="font-bold text-slate-900 mb-1">Approval Required</p>
                                            <p className="text-xs text-slate-500 leading-relaxed">Users requesting to join via the invite link must be manually approved by an Administrator.</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 font-semibold p-4 rounded-xl text-sm text-center border border-red-100">
                                    {error}
                                </div>
                            )}

                            {/* Billing Warning Alert */}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-inner">
                                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <h4 className="text-sm font-bold text-amber-900 mb-1">Important Billing Notice</h4>
                                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                        Upgrading to an Enterprise Organization is an <strong>irreversible</strong> action. Your current personal subscription may be cancelled and, depending on usage, a prorated refund will be issued. Enterprise pricing rates will be applicable from this point forward.
                                    </p>
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="pt-4">
                                <Button size="lg" className="w-full h-14 text-lg font-bold bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-900/20" disabled={loading || !orgName.trim()}>
                                    {loading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : null}
                                    Complete Setup & Upgrade <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                                <p className="text-center text-xs text-slate-500 mt-4">
                                    By upgrading, you agree to the Enterprise Terms of Service. You will be redirected to the Admin Dashboard upon completion.
                                </p>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
