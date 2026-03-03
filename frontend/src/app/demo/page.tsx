"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Activity, Camera, BrainCircuit, ScanLine, ShieldCheck, AlertCircle } from "lucide-react"

type DemoType = 'webcam' | 'cctv' | 'medical'

export default function DemoPage() {
    const [activeDemo, setActiveDemo] = useState<DemoType>('webcam')
    const [isScanning, setIsScanning] = useState(false)
    const [scanComplete, setScanComplete] = useState(false)

    // Reset scan state when switching tabs
    useEffect(() => {
        setIsScanning(false)
        setScanComplete(false)
    }, [activeDemo])

    const runSimulation = () => {
        setIsScanning(true)
        setScanComplete(false)
        setTimeout(() => {
            setIsScanning(false)
            setScanComplete(true)
        }, 2000)
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center pt-28 pb-12 px-4 relative overflow-hidden w-full">

            {/* Background Glow */}
            <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 text-center mb-12 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-2 mb-6">
                    Interactive Preview
                </div>
                <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                    Experience the <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Power of Edge AI</span>
                </h1>
                <p className="text-white/60 text-lg">
                    Select a module below to run a simulated inference pass. Full performance and real-time feeds are unlocked upon enterprise registration.
                </p>
            </div>

            <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Sidebar Navigation */}
                <div className="lg:col-span-4 flex flex-col gap-3">
                    <DemoTab
                        active={activeDemo === 'webcam'}
                        icon={<Activity className="w-5 h-5" />}
                        title="Posture Webcam"
                        desc="Desktop ergonomics telemetry"
                        onClick={() => setActiveDemo('webcam')}
                    />
                    <DemoTab
                        active={activeDemo === 'cctv'}
                        icon={<Camera className="w-5 h-5" />}
                        title="CCTV Daemon"
                        desc="Facility density & compliance"
                        onClick={() => setActiveDemo('cctv')}
                    />
                    <DemoTab
                        active={activeDemo === 'medical'}
                        icon={<BrainCircuit className="w-5 h-5" />}
                        title="Medical AI"
                        desc="Skin, Nail & Visual diagnostics"
                        onClick={() => setActiveDemo('medical')}
                    />

                    <div className="mt-8 p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl">
                        <h3 className="font-semibold text-white mb-2">Ready for production?</h3>
                        <p className="text-sm text-white/50 mb-4">Deploy real models to your own private tenant environment.</p>
                        <Link href="/login" className="block w-full text-center bg-white text-black font-semibold rounded-lg py-2.5 hover:bg-white/90 transition-colors">
                            Create Workspace
                        </Link>
                    </div>
                </div>

                {/* Main Simulator Window */}
                <div className="lg:col-span-8">
                    <div className="h-full min-h-[500px] border border-white/10 rounded-2xl bg-[#111116] shadow-2xl overflow-hidden flex flex-col relative">

                        {/* Fake Header */}
                        <div className="h-12 border-b border-white/10 bg-black/40 flex items-center px-4 gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500/80" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                            <div className="w-3 h-3 rounded-full bg-green-500/80" />
                            <div className="mx-auto text-xs font-mono text-white/40 tracking-wider">
                                {activeDemo.toUpperCase()}_INFERENCE_PIPELINE
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 relative flex items-center justify-center p-8">

                            {/* Scanning Overlay Effect */}
                            {isScanning && (
                                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                                    <div className="w-full h-1 bg-violet-500 shadow-[0_0_20px_#8b5cf6] animate-[scan_2s_ease-in-out_infinite]" />
                                    <div className="absolute inset-0 bg-violet-500/5 animate-pulse" />
                                </div>
                            )}

                            {/* Demo Renderers */}
                            {activeDemo === 'webcam' && (
                                <WebcamSimulation isScanning={isScanning} scanComplete={scanComplete} />
                            )}
                            {activeDemo === 'cctv' && (
                                <CCTVSimulation isScanning={isScanning} scanComplete={scanComplete} />
                            )}
                            {activeDemo === 'medical' && (
                                <MedicalSimulation isScanning={isScanning} scanComplete={scanComplete} />
                            )}
                        </div>

                        {/* Bottom Action Bar */}
                        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-yellow-500 animate-pulse' : scanComplete ? 'bg-green-500' : 'bg-slate-500'}`} />
                                <span className="text-sm text-white/60 font-mono">
                                    {isScanning ? 'PROCESSING TENSOR...' : scanComplete ? 'INFERENCE COMPLETE' : 'SYSTEM IDLE'}
                                </span>
                            </div>
                            <button
                                onClick={runSimulation}
                                disabled={isScanning}
                                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:hover:bg-violet-600 text-white px-5 py-2 rounded-lg font-medium transition-colors text-sm"
                            >
                                <ScanLine className="w-4 h-4" />
                                {scanComplete ? 'Run Again' : 'Execute Model'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tailwind Keyframes for the scanner */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan {
                    0% { transform: translateY(0); }
                    50% { transform: translateY(500px); }
                    100% { transform: translateY(0); }
                }
            `}} />
        </div>
    )
}

function DemoTab({ active, icon, title, desc, onClick }: { active: boolean, icon: React.ReactNode, title: string, desc: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${active
                ? 'bg-violet-500/10 border-violet-500/30'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                }`}
        >
            <div className={`flex items-start gap-4 ${active ? 'text-violet-300' : 'text-white/70'}`}>
                <div className={`mt-1 p-2 rounded-lg ${active ? 'bg-violet-500/20' : 'bg-white/5'}`}>
                    {icon}
                </div>
                <div>
                    <h3 className={`font-semibold mb-1 tracking-tight ${active ? 'text-white' : 'text-white/90'}`}>{title}</h3>
                    <p className="text-sm text-white/50">{desc}</p>
                </div>
            </div>
        </button>
    )
}

// ==========================================
// SIMULATION COMPONENTS (SVG visuals)
// ==========================================

function WebcamSimulation({ isScanning, scanComplete }: { isScanning: boolean, scanComplete: boolean }) {
    return (
        <div className="relative w-full max-w-sm aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden border border-white/5 flex items-end justify-center">
            {/* Fake person silhouette */}
            <div className={`relative transition-all duration-1000 ${scanComplete ? 'opacity-80' : 'opacity-40'}`}>
                <div className="w-24 h-32 bg-slate-400 rounded-t-full absolute bottom-0 left-1/2 -translate-x-1/2" />
                <div className="w-16 h-20 bg-slate-400 rounded-full absolute bottom-[110px] left-1/2 -translate-x-1/2" />

                {/* Bounding box / skeleton overlay when complete */}
                {scanComplete && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute bottom-[20px] left-1/2 -translate-x-1/2 w-32 h-44 border-2 border-green-400/80 rounded bg-green-400/10" />
                        <div className="absolute bottom-[20px] left-[50%] -translate-x-1/2 flex flex-col items-center">
                            <div className="bg-green-500 text-black text-[10px] font-bold px-1.5 py-0.5 whitespace-nowrap -mt-6 rounded-sm">
                                POSTURE: HEALTHY (94%)
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function CCTVSimulation({ isScanning, scanComplete }: { isScanning: boolean, scanComplete: boolean }) {
    return (
        <div className="relative w-full max-w-lg aspect-video bg-slate-900 rounded-lg overflow-hidden border border-white/5 p-8 grid grid-cols-3 gap-8 items-center">
            {/* Fake crowd dots */}
            {[1, 2, 3].map(i => (
                <div key={i} className="flex justify-center relative">
                    <div className={`w-12 h-12 rounded-full ${scanComplete ? 'bg-slate-300' : 'bg-slate-700'} transition-colors duration-500`} />
                    {scanComplete && (
                        <div className="absolute -inset-4 border border-blue-500/60 bg-blue-500/10 rounded flex items-start justify-center">
                            <span className="bg-blue-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-sm -mt-2.5">
                                PERSON {(i * 87) % 100}%
                            </span>
                        </div>
                    )}
                </div>
            ))}

            {scanComplete && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded border border-white/10 backdrop-blur-sm">
                    <ShieldCheck className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-mono text-white/80">Zone Occupancy: 3 / 10</span>
                </div>
            )}
        </div>
    )
}

function MedicalSimulation({ isScanning, scanComplete }: { isScanning: boolean, scanComplete: boolean }) {
    return (
        <div className="relative w-full max-w-sm aspect-square bg-slate-900 rounded-lg overflow-hidden border border-white/5 flex items-center justify-center">
            {/* Fake abstract medical scan (a rounded organic shape) */}
            <div className={`w-40 h-40 rounded-[40%_60%_70%_30%_/_40%_50%_60%_50%] transition-all duration-700 ${scanComplete ? 'bg-rose-900/40 blur-[2px] scale-105' : 'bg-slate-700 blur-[4px]'}`} />

            {scanComplete && (
                <>
                    <div className="absolute w-24 h-24 border border-rose-500 rounded-full scale-110 animate-[ping_3s_ease-out_infinite]" />
                    <div className="absolute w-24 h-24 border border-rose-500 rounded-full" />
                    <div className="absolute top-4 right-4 bg-red-500/20 border border-red-500/50 p-3 rounded-lg flex items-start flex-col gap-1 backdrop-blur-md">
                        <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold uppercase">
                            <AlertCircle className="w-3.5 h-3.5" /> High Risk
                        </div>
                        <div className="text-[10px] text-white/70 font-mono">
                            Onychomycosis: 92.4%<br />
                            Melanonychia: 4.1%
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
