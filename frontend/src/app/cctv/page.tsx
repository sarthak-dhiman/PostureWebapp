"use client"
import { useSubscription } from "@/hooks/useSubscription"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Download, Camera, ShieldCheck, Zap, Server, Activity, ArrowRight, LayoutDashboard, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CCTVProductPage() {
    const { sessionStatus, isLoading, hasSubscription, user, isAdmin } = useSubscription()
    const router = useRouter()
    const [selectedOS, setSelectedOS] = useState<"windows" | "macos" | "linux">("windows")

    const handleDownload = (os: string) => {
        if (isLoading) return
        if (sessionStatus === "unauthenticated" || !user) {
            router.push("/login?callbackUrl=/cctv")
            return
        }
        if (!hasSubscription && !isAdmin) {
            router.push("/settings?error=subscription_required&feature=cctv")
            return
        }
        const osNames: Record<string, string> = {
            windows: "Windows",
            macos: "macOS",
            linux: "Linux"
        }
        alert(`Preparing your download for Posture CCTV Node v2.0.1 (${osNames[os]})...`)
        // In a real scenario: window.location.href = `https://cdn.posturehub.com/cctv-node-setup-${os}.zip`
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

                        <div className="flex flex-col gap-5 mb-12">
                            <div className="flex bg-slate-900 rounded-2xl p-1.5 shadow-xl shadow-slate-900/10 items-center self-start border border-slate-800">
                                <Button
                                    onClick={() => handleDownload(selectedOS)}
                                    disabled={isLoading || (sessionStatus === "authenticated" && !hasSubscription && !isAdmin)}
                                    className="bg-transparent hover:bg-slate-800 text-white font-bold h-12 px-6 rounded-xl flex-grow flex items-center gap-2 transition-transform active:scale-95 group shadow-none disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (sessionStatus === "authenticated" && !hasSubscription && !isAdmin) ? (
                                        <Lock className="w-4 h-4 text-slate-400" />
                                    ) : (
                                        <Download className="w-4 h-4 group-hover:animate-bounce" />
                                    )}
                                    Download
                                </Button>
                                
                                <div className="h-8 w-[1px] bg-slate-700 mx-1"></div>
                                
                                <div className="flex gap-1 pr-1">
                                    <button 
                                        onClick={() => setSelectedOS('windows')}
                                        className={`p-2.5 rounded-xl transition-colors flex items-center justify-center ${selectedOS === 'windows' ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                        title="Windows"
                                    >
                                        <WindowsIcon className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => setSelectedOS('macos')}
                                        className={`p-2.5 rounded-xl transition-colors flex items-center justify-center ${selectedOS === 'macos' ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                        title="macOS"
                                    >
                                        <AppleIcon className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => setSelectedOS('linux')}
                                        className={`p-2.5 rounded-xl transition-colors flex items-center justify-center ${selectedOS === 'linux' ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                        title="Linux"
                                    >
                                        <LinuxIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <Button
                                onClick={handleDashboard}
                                disabled={isLoading}
                                size="lg"
                                variant="outline"
                                className="bg-white border-slate-200 text-slate-800 font-bold h-12 px-6 rounded-2xl hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none self-start"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <LayoutDashboard className="w-4 h-4 text-blue-600" />}
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

function WindowsIcon(props: any) {
  return (
    <svg viewBox="0 0 448 512" fill="currentColor" {...props}>
      <path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z"/>
    </svg>
  )
}

function AppleIcon(props: any) {
  return (
    <svg viewBox="0 0 384 512" fill="currentColor" {...props}>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
    </svg>
  )
}

function LinuxIcon(props: any) {
  return (
    <svg viewBox="0 0 448 512" fill="currentColor" {...props}>
      <path d="M220.8 123.3c1.3-4.3-3.6-10.4-8-9-16.1 5.2-36.4 17.2-46.3 33.6-12.8 21.2-22.1 63.8-22.1 63.8s9.3 22 25.2 24.2c6.2 1.4 14.8-1.7 15.6-7.8 1-6.8-1.5-22.2-1.5-22.2s11.5-35.3 37.1-82.6zm63.4 46.2c-9.9-16.4-30.2-28.4-46.3-33.6-4.4-1.4-9.3 4.7-8 9 25.6 47.3 37.1 82.6 37.1 82.6s-2.5 15.4-1.5 22.2c.8 6.1 9.4 9.2 15.6 7.8 15.9-2.2 25.2-24.2 25.2-24.2s-9.3-42.6-22.1-63.8zM433.9 359c-23-45.7-41.9-63.5-54.8-68.9-8.4-3.6-19.4-4.8-31.2-5.4-8.8-.5-18.1-.8-27.4-.8-6.6 0-13 .1-19.1 .4-41-8-66.2-47.8-66.2-47.8s-40.4-33.1-40.4-65.7c0-26.6 15.9-46.2 36.9-57.9 14.1-7.8 28.5-12.2 38.3-14.7 16-4.1 27.2-6.5 27.2-6.5s3.5-39.7-27.1-51.2c-30.2-11.4-74.8-8.2-101.4 6-27.4 14.7-53.7 49-53.7 104.7 0 32.6 40.4 65.7 40.4 65.7s25.2 39.8 66.2 47.8c-6.1-.3-12.5-.4-19.1-.4-9.3 0-18.6 .3-27.4 .8-11.8 .6-22.8 1.8-31.2 5.4-12.9 5.4-31.8 23.2-54.8 68.9-11 21.6-19 44-24.9 65.9-5.3 19.8-9.2 39.6-11.2 59-.4 4.5 .6 9.1 3 13.1 3.2 5.3 8.8 8.8 15 9.4 7.4 .8 15.1 1.4 23 1.8 17.5 1 37.3 1.2 57.5 .5 13.1-.5 25.7-1.4 37.1-2.9 8.2-1 15-7.1 16.7-15.1 3.9-17.9 12-32.9 21.8-43.2 13.3-13.9 31.5-20.9 52.3-20.9s39 7 52.3 20.9c9.8 10.3 17.9 25.3 21.8 43.2 1.7 8 8.5 14.1 16.7 15.1 11.4 1.5 24 2.4 37.1 2.9 20.2 .7 40 .5 57.5-.5 7.9-.4 15.6-1 23-1.8 6.2-.6 11.8-4.1 15-9.4 2.4-4 3.4-8.6 3-13.1-2-19.4-5.9-39.2-11.2-59-5.9-21.9-13.9-44.3-24.9-65.9z"/>
    </svg>
  )
}
