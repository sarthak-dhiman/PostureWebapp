"use client"

import { useState, useEffect } from "react"
import { useSubscription } from "@/hooks/useSubscription"
import { useRouter, useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Camera, Activity, ShieldCheck, Wifi, WifiOff, Loader2,
    ChevronLeft, AlertTriangle, Users, Play, Clock, MapPin, AlertCircle
} from "lucide-react"
import { CCTVStreamModal } from "@/components/ui/cctv-stream-modal"
import { apiFetch } from "@/lib/api"

export default function NodeDetailPage() {
    const { id } = useParams()
    const { token, isAdmin } = useSubscription()
    const router = useRouter()
    const [refreshInterval, setRefreshInterval] = useState(5000)
    const [selectedCamera, setSelectedCamera] = useState<any>(null)
    const [latestFrames, setLatestFrames] = useState<Record<string, string>>({})
    const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "error" | "closed">("connecting")
    const [debugLog, setDebugLog] = useState<string>("Waiting for websocket messages...")

    const { data, isLoading, error } = useQuery({
        queryKey: ['cctv-node-detail', id],
        queryFn: async () => {
            const resp = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/cctv/nodes/${id}/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!resp.ok) throw new Error("Failed to fetch node details")
            return resp.json()
        },
        enabled: !!token && !!id,
        refetchInterval: refreshInterval
    })

    // Centralized Streaming Websocket
    useEffect(() => {
        if (!id || !token) return

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const wsUrl = `${apiUrl.replace('http', 'ws')}/ws/api/v1/cctv/stream/${id}/`

        const ws = new WebSocket(wsUrl)
        setWsStatus("connecting")

        ws.onopen = () => {
            console.log("[CCTV DEBUG] WebSocket Tunnel Connected ✅")
            setWsStatus("connected")
        }

        ws.onerror = (e) => {
            console.error("[CCTV DEBUG] WebSocket ERROR ❌", e)
            setWsStatus("error")
        }

        ws.onclose = (e) => {
            console.warn("[CCTV DEBUG] WebSocket Tunnel Closed ⚠️", e.code, e.reason)
            setWsStatus("closed")
        }

        ws.onmessage = (event) => {
            try {
                // If it's a heartbeat/ping, ignore
                if (event.data === "pong") return

                // Handle JSON frames (Multi-camera)
                if (typeof event.data === 'string') {
                    const data = JSON.parse(event.data)
                    if (data.type === 'frame' && data.data) {
                        setDebugLog(prev => `[WS] Got frame for uid: ${data.camera_uid}`)
                        setLatestFrames(prev => ({
                            ...prev,
                            [data.camera_uid]: data.data
                        }))
                    }
                }
                // Handle raw binary (Legacy/Binary mode)
                else if (event.data instanceof Blob) {
                    const reader = new FileReader()
                    reader.onload = () => {
                        setLatestFrames(prev => ({
                            ...prev,
                            'legacy_master': reader.result as string
                        }))
                    }
                    reader.readAsDataURL(event.data)
                }
            } catch (e) {
                console.error("[CCTV DEBUG] Frame Ingestion Error:", e)
            }
        }

        return () => {
            console.log("[CCTV DEBUG] Cleaning up Tunnel Connection")
            ws.close()
        }
    }, [id, token])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    <p className="text-slate-500 font-medium animate-pulse">Connecting to edge node...</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full border-rose-100 shadow-xl shadow-rose-900/5">
                    <CardHeader className="text-center">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-rose-500" />
                        </div>
                        <CardTitle className="text-slate-900">Node Connection Failed</CardTitle>
                        <CardDescription>Could not synchronize with the requested edge server.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button onClick={() => router.push('/dashboard/cctv')} variant="outline">
                            Return to Gateway
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">

                {/* Connection Status Alert */}
                {wsStatus !== "connected" && (
                    <div className={`p-4 rounded-xl border flex items-center justify-between mb-6 animate-in slide-in-from-top-2 duration-300 ${wsStatus === "connecting" ? "bg-blue-50 border-blue-200 text-blue-800" :
                        wsStatus === "error" ? "bg-rose-50 border-rose-200 text-rose-800" :
                            "bg-amber-50 border-amber-200 text-amber-800"
                        }`}>
                        <div className="flex items-center gap-3">
                            {wsStatus === "connecting" ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertCircle className="w-5 h-5" />}
                            <div>
                                <p className="font-bold text-sm uppercase tracking-wider leading-none mb-1">
                                    {wsStatus === "connecting" ? "Synchronizing Video Tunnel..." :
                                        wsStatus === "error" ? "Tunnel Error: Connection Refused" :
                                            "Tunnel Suspended: Connection Closed"}
                                </p>
                                <p className="text-[11px] opacity-80 leading-none">
                                    {wsStatus === "connecting" ? "Establishing secure MJPEG-over-Websocket bridge..." :
                                        "Ensure the edge node is powered on and the API key is valid."}
                                </p>
                            </div>
                        </div>
                        <Badge variant="outline" className="font-mono text-[10px] border-current uppercase">
                            STATUS_{wsStatus.toUpperCase()}
                        </Badge>
                    </div>
                )}

                {/* DEV DIAGNOSTICS LOG */}
                <div className="bg-black/90 text-emerald-400 font-mono text-xs p-3 rounded-md mb-4 flex items-center gap-2 border border-emerald-900 shadow-inner">
                    <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                    <span>DIAGNOSTICS: {debugLog}</span>
                </div>

                {/* Header Navigation */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-4">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/cctv">
                            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm border border-slate-200">
                                <ChevronLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">{data.name}</h1>
                                <Badge className={data.status === 'online' ? "bg-emerald-500" : "bg-slate-400"}>
                                    {data.status.toUpperCase()}
                                </Badge>
                            </div>
                            <p className="text-slate-500 flex items-center gap-2 text-sm font-medium">
                                <MapPin className="w-4 h-4" /> Hardware Node ID: <span className="font-mono text-blue-600 bg-blue-50 px-1.5 rounded">{data.id.split('-')[0]}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">
                            Update Level: {refreshInterval === 0 ? 'Paused' : 'Real-time'}
                        </div>
                        <Button
                            onClick={() => setRefreshInterval(refreshInterval === 0 ? 5000 : 0)}
                            variant={refreshInterval === 0 ? "outline" : "secondary"}
                            className="bg-white border-slate-200 shadow-sm font-bold"
                        >
                            {refreshInterval === 0 ? "Resume Stream" : "Pause Stream"}
                        </Button>
                    </div>
                </div>

                {/* Master Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard icon={<Activity className="w-5 h-5 text-emerald-600" />} label="Avg Frame Rate" value={`${Math.round(data.total_fps)} FPS`} color="emerald" />
                    <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} label="Total Tracked" value={data.total_tracked} color="blue" />
                    <StatCard icon={<Camera className="w-5 h-5 text-purple-600" />} label="Active Cameras" value={data.cameras.length} color="purple" />
                    <StatCard icon={<ShieldCheck className="w-5 h-5 text-rose-600" />} label="Pending Threats" value={data.recent_violations.filter((v: any) => v.severity === 'HIGH' || v.severity === 'CRITICAL').length} color="rose" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                    {/* Main Camera Grid */}
                    <div className="xl:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <Play className="w-5 h-5 text-blue-600" /> Live Room Inferences
                            </h2>
                            <p className="text-xs text-slate-400 font-mono tracking-tighter">SIMULATED OVERLAYS ACTIVE</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {data.cameras.map((cam: any) => (
                                <div
                                    key={cam.id}
                                    onClick={() => setSelectedCamera(cam)}
                                    className="cursor-pointer transition-all hover:ring-2 hover:ring-blue-500 rounded-xl"
                                >
                                    <CameraFeedCard
                                        camera={cam}
                                        latestFrame={latestFrames[cam.uid] || latestFrames[cam.name] || latestFrames['legacy_master']}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right column - Violation Feed */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-rose-600" /> Live Violation Log
                        </h2>

                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                                    {data.recent_violations.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <p className="text-slate-400 text-sm font-medium">No violations reported in this session.</p>
                                        </div>
                                    ) : (
                                        data.recent_violations.map((v: any) => (
                                            <div key={v.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <Badge variant="outline" className={`text-[9px] font-black uppercase ${v.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                                        v.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                            'bg-slate-100 text-slate-700 border-slate-200'
                                                        }`}>
                                                        {v.severity}
                                                    </Badge>
                                                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                                        <Clock className="w-2.5 h-2.5" /> {new Date(v.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-900">{v.type}</h4>
                                                <p className="text-[11px] text-slate-500 mt-1">
                                                    Target: <span className="text-slate-700 font-semibold">{v.violator || 'Unknown'}</span> • <span className="italic">{v.camera_name}</span>
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

            </div>

            {/* Real-time Streaming Modal */}
            {selectedCamera && (
                <CCTVStreamModal
                    isOpen={!!selectedCamera}
                    onClose={() => setSelectedCamera(null)}
                    nodeId={id as string}
                    cameraTitle={selectedCamera.name}
                    currentFrame={latestFrames[selectedCamera.uid] || latestFrames[selectedCamera.name] || latestFrames['legacy_master']}
                />
            )}
        </div>
    )
}

function StatCard({ icon, label, value, color }: { icon: any, label: string, value: any, color: string }) {
    const colors: any = {
        emerald: "bg-emerald-50 text-emerald-600",
        blue: "bg-blue-50 text-blue-600",
        rose: "bg-rose-50 text-rose-600",
        purple: "bg-purple-50 text-purple-600"
    }
    return (
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${colors[color]}`}>
                        {icon}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                        <p className="text-2xl font-black text-slate-900">{value}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function CameraFeedCard({ camera, latestFrame }: { camera: any, latestFrame?: string }) {
    return (
        <Card className="bg-slate-900 border-slate-800 shadow-lg overflow-hidden group">
            <div className="aspect-video relative overflow-hidden bg-black flex items-center justify-center">

                {/* Live Feed Video (if available) */}
                {latestFrame && (
                    <img
                        src={latestFrame.startsWith('data:') ? latestFrame : `data:image/jpeg;base64,${latestFrame}`}
                        alt="Live Feed"
                        className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                )}

                {/* Simulated CRT Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[size:100%_3px,3px_100%] pointer-events-none z-10 opacity-40" />

                {/* Simulated Bounding Boxes (Driven by people count) */}
                <div className="absolute inset-0 p-8 grid grid-cols-4 grid-rows-3 gap-4 opacity-30">
                    {Array.from({ length: Math.min(camera.tracked_persons, 12) }).map((_, i) => (
                        <div key={i} className="border-2 border-emerald-500 rounded relative group-hover:scale-105 transition-transform">
                            <div className="absolute -top-4 left-0 text-[6px] font-mono text-emerald-400 bg-emerald-950/80 px-1 py-0.5 border border-emerald-500/50">
                                PERSON #{(i + 1).toString().padStart(3, '0')}
                            </div>
                        </div>
                    ))}
                </div>

                {/* REC Status */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2 py-1 bg-black/40 backdrop-blur-md rounded border border-white/5">
                    {camera.is_legacy && (
                        <Badge className="bg-amber-500/20 text-amber-400 text-[8px] h-4 border-amber-500/30 px-1 py-0 mr-1">LEGACY</Badge>
                    )}
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                    <span className="text-[10px] font-black text-white/80 tracking-tighter">
                        {camera.is_legacy ? "MASTER" : `CAM ${camera.uid.toUpperCase()}`}
                    </span>
                </div>

                {/* Center Label */}
                <div className="flex flex-col items-center gap-1 z-20">
                    <Activity className="w-10 h-10 text-emerald-500/20 animate-pulse" />
                    <span className="text-emerald-500/30 text-[10px] font-mono tracking-[0.3em] uppercase">
                        {camera.is_legacy ? "AGGREGATE FEED" : `${camera.room_type} ROOM`}
                    </span>
                </div>


                {/* Bottom Overlay Stats */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent z-20">
                    <div className="flex justify-between items-end">
                        <div>
                            <h3 className="text-white font-black text-lg shadow-sm leading-none mb-1">{camera.name}</h3>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${camera.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                    {camera.is_active ? 'CONNECTED' : 'FAIL_NO_SIGNAL'}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-white font-mono leading-none">{camera.tracked_persons}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Persons</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hover footer detail */}
            <div className="p-3 bg-slate-800 border-t border-slate-700 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">FPS: <span className="text-emerald-400">{camera.fps.toFixed(1)}</span></span>
                <span className="text-slate-400 shrink-0">BITRATE: <span className="text-blue-400">4.2Mbps</span></span>
            </div>
        </Card>
    )
}
