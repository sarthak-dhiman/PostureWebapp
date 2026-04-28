"use client"
import { useSubscription } from "@/hooks/useSubscription"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Download, Camera, ShieldCheck, Zap, Server, Activity, ArrowRight, LayoutDashboard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CCTVProductPage() {
    const { sessionStatus, isLoading, hasSubscription, user, isAdmin } = useSubscription()
    const router = useRouter()

    const handleDownload = () => {
        if (isLoading) return
        if (sessionStatus === "unauthenticated" || !user) {
            router.push("/login?callbackUrl=/cctv")
            return
        }
        if (!hasSubscription && !isAdmin) {
            router.push("/settings?error=subscription_required&feature=cctv")
            return
        }
        alert("Preparing your download for Posture CCTV Node v2.0.1 (Linux/Windows)...")
        // In a real scenario: window.location.href = "https://cdn.posturehub.com/cctv-node-setup.zip"
    }

    const handleDashboard = () => {
        if (isLoading) return
        if (sessionStatus === "unauthenticated" || !user) {
            router.push("/login?callbackUrl=/cctv")
            return
        }
        if (!hasSubscription && !isAdmin) {
            router.push("/settings?error=subscription_required&feature=cctv")
            return
        }
        router.push("/dashboard")
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-28 pb-20 overflow-x-hidden relative">
            {/* Decorative BG elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-[10%]" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-100/50 rounded-full blur-3xl -z-10 translate-y-1/2 -translate-x-[10%]" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                    {/* Content Section */}
                    <div className="animate-in fade-in slide-in-from-left-8 duration-700">
                        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-100 rounded-full px-4 py-2 mb-8">
                            <Camera className="w-3.5 h-3.5" /> Facility Monitoring
                        </div>

                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6 leading-tight">
                            Smart Surveillance, <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">Elevated by AI.</span>
                        </h1>

                        <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
                            Deploy lightweight Python monitoring nodes to your existing IP cameras. Track worker ergonomics, safety compliance, and operational efficiency across your entire facility.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 mb-12">
                            <Button
                                onClick={handleDownload}
                                disabled={isLoading}
                                size="lg"
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 px-8 rounded-2xl shadow-xl shadow-slate-900/10 flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 group disabled:opacity-70 disabled:pointer-events-none"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5 group-hover:animate-bounce" />}
                                Download CCTV Node
                            </Button>

                            <Button
                                onClick={handleDashboard}
                                disabled={isLoading}
                                size="lg"
                                variant="outline"
                                className="bg-white border-slate-200 text-slate-800 font-bold h-14 px-8 rounded-2xl hover:bg-blue-50 transition-colors flex items-center gap-3 disabled:opacity-70 disabled:pointer-events-none"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> : <LayoutDashboard className="w-5 h-5 text-blue-600" />}
                                Open Dashboard
                            </Button>
                        </div>

                        {/* Feature Pillars */}
                        <div className="grid grid-cols-2 gap-6">
                            <FeatureItem
                                icon={<Server className="w-4 h-4 text-blue-600" />}
                                title="Edge Deployment"
                                desc="Runs securely on local servers or edge devices."
                            />
                            <FeatureItem
                                icon={<Zap className="w-4 h-4 text-blue-600" />}
                                title="Multi-feed Inference"
                                desc="Process multiple RTSP/HTTP streams concurrently."
                            />
                        </div>
                    </div>

                    {/* Visual Section (Mock Screenshot/Card) */}
                    <div className="relative animate-in fade-in slide-in-from-right-8 duration-700">
                        <div className="bg-white rounded-[2rem] p-4 shadow-2xl border border-slate-200 transform lg:rotate-2 hover:rotate-0 transition-transform duration-500">
                            <div className="bg-slate-900 rounded-[1.5rem] aspect-video overflow-hidden relative group">
                                {/* Mock UI Elements */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-cyan-900/20" />

                                {/* Fake Grid Background effect */}
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />

                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full p-4">
                                        <div className="bg-black/50 border border-blue-500/30 rounded relative overflow-hidden">
                                            <div className="absolute top-2 left-2 bg-red-500 rounded px-1.5 py-0.5 text-[8px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Cam 01
                                            </div>
                                        </div>
                                        <div className="bg-black/50 border border-blue-500/30 rounded relative overflow-hidden">
                                            <div className="absolute top-2 left-2 bg-red-500 rounded px-1.5 py-0.5 text-[8px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Cam 02
                                            </div>
                                        </div>
                                        <div className="bg-black/50 border border-blue-500/30 rounded relative overflow-hidden">
                                            <div className="absolute top-2 left-2 bg-red-500 rounded px-1.5 py-0.5 text-[8px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> Cam 03
                                            </div>
                                        </div>
                                        <div className="bg-black/50 border border-blue-500/30 rounded relative overflow-hidden flex items-center justify-center">
                                            <div className="text-blue-400/50 text-xs font-mono">NO SIGNAL</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center">
                                            <ActivityIcon className="w-5 h-5 text-cyan-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Node Status</p>
                                            <p className="text-sm font-bold text-white">ACTIVE (3 Feeds)</p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 bg-blue-500/80 text-white text-[10px] font-black uppercase rounded-lg border border-blue-400/50">YOLOv8 DETECT</div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Badges */}
                        <div className="absolute -top-6 -right-6 p-6 bg-white rounded-2xl shadow-xl border border-slate-100 animate-bounce duration-[3000ms]">
                            <Camera className="w-8 h-8 text-blue-500" />
                        </div>
                        <div className="absolute -bottom-6 -left-6 p-6 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Low Latency</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Extra Info Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-32">
                <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-200">
                    <h2 className="text-3xl font-black text-slate-900 mb-8">System Requirements</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <FAQItem
                            q="What cameras are supported?"
                            a="Any IP camera that supports RTSP or HTTP streams can be connected to the CCTV node. Standard resolutions and framerates are fully supported."
                        />
                        <FAQItem
                            q="How is data secured?"
                            a="The node processes video locally and only transmits metadata (like bounding boxes and classifications) to the cloud using API keys. No video feeds are uploaded."
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">{title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}

function FAQItem({ q, a }: { q: string, a: string }) {
    return (
        <div>
            <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-500" /> {q}
            </h4>
            <p className="text-slate-600 leading-relaxed">{a}</p>
        </div>
    )
}

function ActivityIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}
