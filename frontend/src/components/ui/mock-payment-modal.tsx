"use client"

import { useState, useEffect } from "react"
import { Loader2, X, ShieldCheck, CreditCard, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { useRouter } from "next/navigation"

interface MockPaymentModalProps {
    isOpen: boolean
    onClose: () => void
    planName: string
    subscriptionId?: string
    orderId?: string
    token: string
}

export function MockPaymentModal({ isOpen, onClose, planName, subscriptionId, orderId, token }: MockPaymentModalProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const handleSimulateSuccess = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/billing/mock-success/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    subscription_id: subscriptionId,
                    order_id: orderId
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.detail || "Failed to simulate payment success")
            }

            // Success!
            onClose()
            if (subscriptionId) {
                router.push(`/dashboard?subscription_id=${subscriptionId}&status=success`)
            } else {
                router.push(`/pricing?gift_success=true`)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-amber-50 p-4 flex items-center gap-3 border-b border-amber-100">
                    <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">Simulated Billing Mode</h3>
                        <p className="text-[10px] text-amber-700 font-bold uppercase tracking-tight">No real charges will be made</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-auto text-amber-400 hover:text-amber-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8">
                    <div className="bg-violet-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-white rotate-3 shadow-lg shadow-violet-200">
                        <CreditCard className="w-8 h-8" />
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                        Confirm {planName}
                    </h2>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                        You are testing the Posture OS checkout flow. Since no payment gateway keys are configured, you can click the button below to simulate a successful payment notification from Razorpay.
                    </p>

                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <span>Identity</span>
                                <span className="text-slate-900 uppercase">Test Account</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                                <span>Reference</span>
                                <span className="text-slate-900 truncate max-w-[150px]">{subscriptionId || orderId || "N/A"}</span>
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-600 bg-red-50 p-4 rounded-2xl text-xs font-bold border border-red-100 animate-shake">
                                {error}
                            </div>
                        )}

                        <Button
                            onClick={handleSimulateSuccess}
                            className="w-full bg-slate-900 hover:bg-black text-white font-black h-14 rounded-2xl text-lg shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="w-5 h-5 mr-3 text-emerald-400" />
                                    Simulate Success
                                </>
                            )}
                        </Button>

                        <button
                            onClick={onClose}
                            className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 py-2 transition-colors uppercase tracking-widest"
                        >
                            Cancel Transaction
                        </button>
                    </div>
                </div>

                {/* Footer Decoration */}
                <div className="h-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500" />
            </div>
        </div>
    )
}
