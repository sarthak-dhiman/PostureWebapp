"use client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Download, ShieldCheck, Zap, Monitor, Cpu, Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AnalyzerDownloadPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const handleDownload = () => {
        if (status === "unauthenticated") {
            router.push("/login?callbackUrl=/analyzer")
            return
        }

        // Mock download trigger
        alert("Preparing your download for Posture Analyzer v1.2.0 (Windows x64)...")
        // In a real scenario: window.location.href = "https://cdn.posturehub.com/analyzer-setup.exe"
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-28 pb-20 overflow-hidden relative">
            {/* Decorative BG elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-100/50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/50 rounded-full blur-3xl -z-10 translate-y-1/2 -translate-x-1/2" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                    {/* Content Section */}
                    <div className="animate-in fade-in slide-in-from-left-8 duration-700">
                        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-600 bg-violet-100 rounded-full px-4 py-2 mb-8">
                            <Monitor className="w-3.5 h-3.5" /> Desktop Application
                        </div>

                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6 leading-tight">
                            Your Posture Assistant, <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Always On Guard.</span>
                        </h1>

                        <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
                            The Posture Analyzer is a lightweight desktop app that uses your webcam to monitor ergonomics in real-time. It runs 100% locally for ultimate privacy.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 mb-12">
                            <Button
                                onClick={handleDownload}
                                size="lg"
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 px-8 rounded-2xl shadow-xl shadow-slate-900/10 flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 group"
                            >
                                <Download className="w-5 h-5 group-hover:animate-bounce" />
                                Download for Windows
                            </Button>
                            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl border border-slate-200 bg-white/50 backdrop-blur">
                                <div className="p-1.5 bg-green-100 rounded-lg">
                                    <ShieldCheck className="w-4 h-4 text-green-600" />
                                </div>
                                <span className="text-xs font-medium text-slate-500">v1.2.0 • Secured by SHA-256</span>
                            </div>
                        </div>

                        {/* Feature Pillars */}
                        <div className="grid grid-cols-2 gap-6">
                            <FeatureItem
                                icon={<Lock className="w-4 h-4 text-violet-600" />}
                                title="Privacy First"
                                desc="Zero video data ever leaves your machine."
                            />
                            <FeatureItem
                                icon={<Cpu className="w-4 h-4 text-violet-600" />}
                                title="Ultra Lightweight"
                                desc="Runs under 2% CPU usage while monitoring."
                            />
                        </div>
                    </div>

                    {/* Visual Section (Mock Screenshot/Card) */}
                    <div className="relative animate-in fade-in slide-in-from-right-8 duration-700">
                        <div className="bg-white rounded-[2rem] p-4 shadow-2xl border border-slate-200 transform lg:rotate-3 hover:rotate-0 transition-transform duration-500">
                            <div className="bg-slate-900 rounded-[1.5rem] aspect-video overflow-hidden relative group">
                                {/* Mock UI Elements */}
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-indigo-500/10" />

                                {/* Fake Scanner Effect */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.5)] animate-[scan_3s_ease-in-out_infinite]" />

                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-24 h-24 border-2 border-violet-400/50 rounded-full flex items-center justify-center animate-pulse">
                                        <Monitor className="w-10 h-10 text-white/80" />
                                    </div>
                                </div>

                                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center">
                                            <ActivityIcon className="w-5 h-5 text-green-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Stability</p>
                                            <p className="text-sm font-bold text-white">HEALTHY (98.4%)</p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 bg-violet-500 text-white text-[10px] font-black uppercase rounded-lg">LIVE FEED</div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Tech Badges */}
                        <div className="absolute -top-6 -right-6 p-6 bg-white rounded-2xl shadow-xl border border-slate-100 animate-bounce duration-[3000ms]">
                            <Zap className="w-8 h-8 text-amber-500" />
                        </div>
                        <div className="absolute -bottom-6 -left-6 p-6 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Optimized for x64</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Extra FAQ/Info Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-32">
                <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-200">
                    <h2 className="text-3xl font-black text-slate-900 mb-8">Frequently Asked Questions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <FAQItem
                            q="Does the app record my video?"
                            a="Absolutely not. The Posture Analyzer processes frames in RAM locally and discards them immediately after inference. No images are saved or transmitted."
                        />
                        <FAQItem
                            q="Will it slow down my computer?"
                            a="Our models are optimized for modern processors. The app runs as a low-priority background process and typically uses less than 150MB of memory."
                        />
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(200px); }
                    100% { transform: translateY(0); }
                }
            `}} />
        </div>
    )
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
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
                <ArrowRight className="w-4 h-4 text-violet-500" /> {q}
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
