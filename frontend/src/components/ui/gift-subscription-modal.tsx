"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, X, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface GiftSubscriptionModalProps {
    isOpen: boolean
    onClose: () => void
    priceId: string
    planName: string
}

export function GiftSubscriptionModal({ isOpen, onClose, priceId, planName }: GiftSubscriptionModalProps) {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [recipientEmail, setRecipientEmail] = useState("")
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

        setIsLoading(true)
        setError(null)

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/billing/gift/checkout/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${(session as any)?.user?.accessToken || (session as any)?.accessToken}`,
                },
                body: JSON.stringify({
                    price_id: priceId,
                    recipient_email: recipientEmail
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || data.error || "Failed to create gift checkout session")
            }

            if (data.url) {
                // Redirect user to Stripe
                window.location.href = data.url
            } else {
                throw new Error("No checkout URL returned from server")
            }
        } catch (err: any) {
            console.error("Gift Subscription Error:", err)
            setError(err.message)
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
                                disabled={isLoading}
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
