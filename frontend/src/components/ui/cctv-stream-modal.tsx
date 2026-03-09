"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Loader2, WifiOff, X } from "lucide-react"

interface CCTVStreamModalProps {
    isOpen: boolean
    onClose: () => void
    nodeId: string
    cameraTitle: string
    currentFrame?: string
}

export function CCTVStreamModal({ isOpen, onClose, nodeId, cameraTitle, currentFrame }: CCTVStreamModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [fps, setFps] = useState(0)
    const frameCountRef = useRef(0)

    // Derived status based on frame availability
    const status = currentFrame ? "live" : "connecting"

    // Render incoming frame to canvas efficiently
    useEffect(() => {
        if (!isOpen || !currentFrame || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const img = new Image()
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            frameCountRef.current++
        }
        img.src = currentFrame.startsWith('data:') ? currentFrame : `data:image/jpeg;base64,${currentFrame}`
    }, [currentFrame, isOpen])

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // FPS Tracker
    useEffect(() => {
        if (!isOpen) return
        const interval = setInterval(() => {
            setFps(frameCountRef.current)
            frameCountRef.current = 0
        }, 1000)
        return () => clearInterval(interval)
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden border border-slate-800">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-6 top-6 text-slate-400 hover:text-white transition-colors z-[110] bg-black/40 p-2 rounded-full backdrop-blur-md border border-white/5"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="relative aspect-video bg-black flex items-center justify-center">
                    {/* Main Video Surface */}
                    <canvas
                        ref={canvasRef}
                        width={1280}
                        height={720}
                        className="w-full h-full object-contain z-0"
                    />

                    {/* Overlays */}
                    <div className="absolute inset-0 pointer-events-none z-10">
                        {/* Status Bar */}
                        <div className="absolute top-6 left-6 flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <h2 className="text-white font-black text-2xl tracking-tighter uppercase">{cameraTitle}</h2>
                                <Badge className={status === "live" ? "bg-emerald-500" : "bg-rose-500"}>
                                    {status.toUpperCase()}
                                </Badge>
                            </div>
                            <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest font-bold">TUNNEL_ID: {nodeId}</p>
                        </div>

                        <div className="absolute top-6 right-16 flex flex-col items-end gap-1">
                            <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded px-2 py-1 flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${status === "live" ? "bg-rose-600 animate-pulse" : "bg-slate-600"}`} />
                                <span className="text-[10px] font-black text-white/80 tracking-tighter uppercase font-mono">REC LIVE</span>
                            </div>
                            <span className="text-emerald-400 font-mono text-[10px] font-bold">FPS_OUTPUT: {fps}</span>
                        </div>

                        {/* Connection Warning */}
                        {status !== "live" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20 pointer-events-auto">
                                <div className="flex flex-col items-center gap-4">
                                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                                    <p className="text-blue-400 font-bold uppercase tracking-widest text-xs">Waiting for Edge Stream...</p>
                                </div>
                            </div>
                        )}

                        {/* Scopes & HUD */}
                        <div className="absolute inset-0 border-[30px] border-emerald-500/5 pointer-events-none" />
                        <div className="absolute top-1/2 left-6 h-20 w-[1px] bg-emerald-500/20 -translate-y-1/2" />
                        <div className="absolute top-1/2 right-6 h-20 w-[1px] bg-emerald-500/20 -translate-y-1/2" />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-5 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono font-bold tracking-widest">
                    <div className="flex gap-6 uppercase">
                        <span className="text-slate-500">PROTOCOL: <span className="text-slate-200">BINARY_MJPEG</span></span>
                        <span className="text-slate-500">ENCRYPTION: <span className="text-emerald-500">TLS_SECURE</span></span>
                    </div>
                    <span className="text-slate-500">CLOCK: <span className="text-slate-200">{new Date().toLocaleTimeString()}</span></span>
                </div>
            </div>
        </div>
    )
}
