"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, X, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch, getApiUrl } from "@/lib/api"

interface GiftSubscriptionModalProps {
    isOpen: boolean
    onClose: () => void
    planId: string
    planName: string
}

export function GiftSubscriptionModal({ isOpen, onClose, planId, planName }: GiftSubscriptionModalProps) {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [recipientEmail, setRecipientEmail] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [razorpayScriptLoaded, setRazorpayScriptLoaded] = useState(false)

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // Dynamically inject the Razorpay checkout script
    useEffect(() => {
        if (!isOpen) return;

        const loadRazorpay = () => {
            if (document.getElementById("razorpay-checkout-gift-js")) {
                setRazorpayScriptLoaded(true)
                return
            }

            const script = document.createElement("script")
            script.id = "razorpay-checkout-gift-js"
            script.src = "https://checkout.razorpay.com/v1/checkout.js"
            script.async = true
            script.onload = () => setRazorpayScriptLoaded(true)
            script.onerror = () => {
                console.error("Failed to load Razorpay script")
                setError("Payment gateway failed to load. Please check your connection.")
            }
            document.body.appendChild(script)
        }

        loadRazorpay()
    }, [isOpen])

    if (!isOpen) return null

    const handleGift = async (e: React.FormEvent) => {
        e.preventDefault()

        // Auth check
        if (status === "unauthenticated" || !session) {
            onClose()
            router.push(`/login?callbackUrl=/pricing`)
            return
        }

        if (!recipientEmail || !recipientEmail.includes('@')) {
            setError("Please enter a valid email address.")
            return
        }

        if (!razorpayScriptLoaded || !(window as any).Razorpay) {
            setError("Payment gateway is still loading. Please try again in a moment.")
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            // Step 1: Tell the backend to create a Razorpay Order
            const res = await apiFetch(getApiUrl('/api/v1/billing/gift/checkout/'), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${(session?.user as any)?.accessToken || (session as any)?.accessToken}`,
                },
                body: JSON.stringify({
                    plan_id: planId,
                    recipient_email: recipientEmail
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || data.error || "Failed to initialize gift order")
            }

            if (!data.order_id) {
                throw new Error("No active order generated.")
            }

            const orderId = String(data.order_id)
            // Backend mock path returns this literal; real Razorpay order ids look like order_xxx
            if (orderId === "order_test_mock") {
                onClose()
                router.push(`/pricing?gift_success=true`)
                return
            }

            const pubKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ""
            if (!pubKey) {
                throw new Error("Payment is not configured (missing NEXT_PUBLIC_RAZORPAY_KEY_ID).")
            }

            // Step 2: Initialize Razorpay Checkout inline modal for ONE-TIME ORDERS
            const options = {
                key: pubKey,
                order_id: data.order_id,
                name: "Posture OS",
                description: `Gift: ${planName}`,
                image: "/icon.png",
                handler: function (response: any) {
                    onClose()
                    router.push(`/pricing?gift_success=true`)
                },
                prefill: {
                    name: session.user?.name || "",
                    email: session.user?.email || "",
                },
                theme: {
                    color: "#7c3aed",
                },
            }

            const rzp = new (window as any).Razorpay(options)

            rzp.on('payment.failed', function (response: any) {
                console.error("Gift Payment failed", response.error)
                setError(`Payment failed: ${response.error.description}`)
            })

            rzp.open()

        } catch (err: any) {
            console.error("Gift Subscription Error:", err)
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden border border-slate-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 md:p-8">
                    <div className="bg-violet-100 w-14 h-14 rounded-full flex items-center justify-center mb-5 text-violet-600">
                        <Gift className="w-7 h-7" />
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                        Gift {planName}
                    </h2>
                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                        Send a Posture OS subscription to a friend or colleague. They will receive an email invitation to claim it. If they don't accept within 15 days, you'll be automatically refunded.
                    </p>

                    <form onSubmit={handleGift} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="recipientEmail" className="text-sm font-bold text-slate-900">
                                Recipient's Email
                            </label>
                            <Input
                                id="recipientEmail"
                                type="email"
                                placeholder="colleague@example.com"
                                value={recipientEmail}
                                onChange={(e) => setRecipientEmail(e.target.value)}
                                className="h-12 border-slate-200"
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-red-600 bg-red-50 p-3 rounded-lg text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full text-slate-600"
                                onClick={onClose}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-md shadow-violet-500/20"
                                disabled={isLoading || !razorpayScriptLoaded}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing
                                    </>
                                ) : (
                                    "Continue to Payment"
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
