"use client"

import { useState, useEffect } from "react"
import { useSubscription } from "@/hooks/useSubscription"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Camera, Server, ShieldCheck, Activity, Copy, Check,
    AlertCircle, Wifi, WifiOff, Loader2, Plus, GripHorizontal, PlaySquare
} from "lucide-react"

export default function CameraGatewayPage() {
    const { sessionStatus, isLoading, hasSubscription, user, isAdmin, token, org } = useSubscription()
    const router = useRouter()
    const [copied, setCopied] = useState(false)

    // Unauthorized non-admins should be kicked back
    useEffect(() => {
        if (!isLoading && sessionStatus === "authenticated" && !isAdmin) {
            router.push('/profile')
        }
    }, [sessionStatus, isLoading, isAdmin, router])

    const fetchNodes = async () => {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/cctv/dashboard/nodes/`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) throw new Error("Failed to fetch CCTV nodes")
        return res.json()
    }

    const { data: nodesData, isLoading: isLoadingNodes } = useQuery({
        queryKey: ["cctvNodes", org?.id],
        queryFn: fetchNodes,
        enabled: !!token && !!hasSubscription && isAdmin,
        refetchInterval: 10000 // Poll every 10 seconds for real-time telemetry updates
    })

    const nodes = nodesData?.nodes || []

    if (isLoading || sessionStatus === "unauthenticated" || !user) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
            </div>
        )
    }

    if (!isAdmin) return null

    const apiKey = "ph_live_" + Buffer.from(org?.id?.toString() || "demo").toString('base64').replace(/=/g, '') + "X9jL2"

    const copyKey = () => {
        navigator.clipboard.writeText(apiKey)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (!hasSubscription) {
        // Just in case they bypass the dashboard check
        return (
            <div className="container mx-auto p-6 pt-24 max-w-4xl">
                <Card className="border-rose-200 shadow-sm bg-rose-50">
                    <CardHeader className="text-center">
                        <ShieldCheck className="w-12 h-12 text-rose-500 mx-auto mb-2" />
                        <CardTitle className="text-2xl font-black text-rose-900">Subscription Required</CardTitle>
                        <CardDescription className="text-rose-700">
                            The Camera Gateway is an Enterprise feature. Please upgrade your plan to connect edge nodes.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center">
                        <Link href="/settings">
                            <Button className="bg-rose-600 hover:bg-rose-700 font-bold">Manage Billing</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-24 pb-20 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-rose-100/40 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/3" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold uppercase tracking-wider mb-3">
                            <Camera className="w-3.5 h-3.5" /> Posture Edge AI
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-slate-900">Camera Gateway</h1>
                        <p className="text-slate-500 mt-2 text-lg">Manage physical edge nodes and RTMP security feeds for <span className="font-bold text-slate-700">{user.organization?.name}</span>.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link href="/cctv">
                            <Button variant="outline" className="font-bold border-slate-200">
                                <Server className="w-4 h-4 mr-2" />
                                Download Node Agent
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column - Connection Details */}
                    <div className="lg:col-span-1 space-y-6">

                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 to-orange-500" />
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-rose-500" />
                                    Connection Details
                                </CardTitle>
                                <CardDescription>Use this key to authenticate your Edge AI Python worker.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Organization API Key</label>
                                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                        <input
                                            readOnly
                                            type="password"
                                            value={apiKey}
                                            className="bg-transparent border-none text-sm w-full px-3 py-2 text-slate-800 font-mono focus:outline-none"
                                        />
                                        <Button size="sm" variant="secondary" onClick={copyKey} className="shrink-0 bg-white shadow-sm">
                                            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 uppercase">Do not share this key publicly. It provides ingest access to your posture stream.</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-900 border-slate-800 text-slate-100 overflow-hidden relative">
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />
                            <CardHeader className="relative pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-emerald-400" />
                                    Network Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="relative space-y-6 pt-4">

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Active Nodes</p>
                                        <p className="text-3xl font-black text-white">{nodes.filter((n: any) => n.status === 'online').length}</p>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Total FPS</p>
                                        <p className="text-3xl font-black text-white">{nodes.reduce((acc: number, curr: any) => acc + (curr.fps || 0), 0)}</p>
                                    </div>
                                </div>

                            </CardContent>
                        </Card>

                    </div>

                    {/* Right Column - Nodes List */}
                    <div className="lg:col-span-2">
                        <Card className="border-slate-200 shadow-sm h-full flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        Live Node Feeds
                                        {isLoadingNodes && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                                    </CardTitle>
                                    <CardDescription>Real-time telemetry and feed status</CardDescription>
                                </div>
                                <Badge variant="secondary" className="bg-rose-100 text-rose-800 hover:bg-rose-100 font-bold border-none">
                                    {nodes.length} Nodes
                                </Badge>
                            </CardHeader>
                            <CardContent className="flex-1 p-4 bg-slate-50/50">
                                {nodes.length === 0 && !isLoadingNodes ? (
                                    <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200 border-dashed">
                                            <WifiOff className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">No edge nodes detected</h3>
                                        <p className="text-slate-500 max-w-sm mt-2 mb-6">
                                            Download the agent and connect it using your Organization API Key to begin transmitting telemetry data.
                                        </p>
                                        <Link href="/cctv">
                                            <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-11">
                                                <Plus className="w-4 h-4 mr-2" /> Register New Node
                                            </Button>
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {nodes.map((node: any) => (
                                            <Link
                                                key={node.id}
                                                href={`/dashboard/cctv/${node.id}`}
                                                className="group relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 shadow-lg aspect-video flex flex-col hover:border-blue-500/50 transition-all cursor-pointer"
                                            >

                                                {/* Simulated Feed View (Empty state) */}
                                                <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                                                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%] pointer-events-none z-10 opacity-30" />

                                                    {node.status === 'online' ? (
                                                        <>
                                                            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2 py-1 bg-black/40 backdrop-blur-md rounded-md border border-white/10">
                                                                <div className="w-2 h-2 rounded-full bg-rose-600 animate-pulse shadow-[0_0_8px_rgba(225,29,72,0.8)]" />
                                                                <span className="text-[10px] font-black text-white/90 tracking-tighter">REC</span>
                                                            </div>
                                                            <div className="absolute inset-0 bg-slate-800/50 flex flex-col items-center justify-center gap-2">
                                                                <Activity className="w-8 h-8 text-emerald-500/30 animate-pulse" />
                                                                <span className="text-emerald-500/50 text-xs font-mono tracking-widest uppercase">Receiving Telemetry</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-2">
                                                            <WifiOff className="w-8 h-8 text-rose-500/30" />
                                                            <span className="text-rose-500/50 text-xs font-mono tracking-widest uppercase">Connection Lost</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Top Overlay Stats */}
                                                <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-rose-500 animate-pulse' : 'bg-slate-500'}`} />
                                                            <h4 className="font-bold text-white shadow-sm text-sm">{node.name}</h4>
                                                        </div>
                                                        <p className="text-[10px] text-slate-300 font-mono flex items-center gap-1">
                                                            ID: {node.id.split('-')[0]}
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0 border-none ${node.status === 'online' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                                        {node.status === 'online' ? 'LIVE' : 'OFFLINE'}
                                                    </Badge>
                                                </div>

                                                {/* Bottom Overlay Stats */}
                                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                                                    <div className="grid grid-cols-3 gap-2 divide-x divide-slate-700/50">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <span className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5 font-semibold">FPS</span>
                                                            <span className="text-emerald-400 font-mono font-bold">{Math.round(node.fps)}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center justify-center pl-2">
                                                            <span className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5 font-semibold">Tracked</span>
                                                            <span className="text-sky-400 font-mono font-bold">{node.active_tracked_persons || 0}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center justify-center pl-2">
                                                            <span className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5 font-semibold">Feeds</span>
                                                            <span className="text-white font-mono font-bold">{node.feeds}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </div>
    )
}
