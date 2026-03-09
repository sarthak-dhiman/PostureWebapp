"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { MockPaymentModal } from "./mock-payment-modal"

interface SubscribeButtonProps {
    planId: string
    planName: string
    className?: string
    buttonText?: string
    fallbackUrl?: string
    amount?: number // Used for display context if needed
}

export function SubscribeButton({ planId, planName, className = "", buttonText = "Subscribe", fallbackUrl }: SubscribeButtonProps) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [razorpayScriptLoaded, setRazorpayScriptLoaded] = useState(false)
    const [mockModal, setMockModal] = useState<{ isOpen: boolean, subscriptionId?: string }>({ isOpen: false })

    // Dynamically inject the Razorpay checkout script
    useEffect(() => {
        const loadRazorpay = () => {
            if (document.getElementById("razorpay-checkout-js")) {
                setRazorpayScriptLoaded(true)
                return
            }

            const script = document.createElement("script")
            script.id = "razorpay-checkout-js"
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
    }, [])

    const handleSubscribe = async () => {
        // If the user isn't logged in, redirect them to login with a callback
        if (status === "unauthenticated" || !session) {
            router.push(fallbackUrl || `/login?callbackUrl=/pricing`)
            return
        }

        if (!razorpayScriptLoaded || !(window as any).Razorpay) {
            setError("Payment gateway is still loading. Please try again in a moment.")
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            // Step 1: Tell the backend to create a Razorpay Subscription
            const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/billing/checkout/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${(session as any)?.user?.accessToken || (session as any)?.accessToken}`,
                },
                body: JSON.stringify({ plan_id: planId }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || data.error || "Failed to initialize subscription")
            }

            if (!data.subscription_id) {
                throw new Error("No subscription ID returned from server")
            }

            // If the backend bypassed Razorpay (missing keys), it might return a mock ID.
            if (data.subscription_id.startsWith('sub_mock_')) {
                setMockModal({ isOpen: true, subscriptionId: data.subscription_id })
                return
            }

            // Step 2: Initialize Razorpay Checkout inline modal
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
                subscription_id: data.subscription_id,
                name: "Posture OS",
                description: `${planName} Subscription`,
                image: "/icon.png",
                handler: function (response: any) {
                    // Razorpay returns razorpay_payment_id, razorpay_subscription_id, razorpay_signature here.
                    // The webhook will handle backend activation; we just need to redirect the user to success.
                    router.push(`/dashboard?subscription_id=${response.razorpay_subscription_id}&status=success`)
                },
                prefill: {
                    name: session.user?.name || "",
                    email: session.user?.email || "",
                },
                theme: {
                    color: "#7c3aed", // violet-600 to match Posture OS theme
                },
            }

            const rzp = new (window as any).Razorpay(options)

            rzp.on('payment.failed', function (response: any) {
                console.error("Payment failed", response.error)
                setError(`Payment failed: ${response.error.description}`)
            })

            rzp.open()

        } catch (err: any) {
            console.error("Subscription Error:", err)
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full">
            <Button
                onClick={handleSubscribe}
                disabled={isLoading || !razorpayScriptLoaded}
                className={`w-full font-bold h-11 rounded-xl transition-all border-none ${className}`}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                    </>
                ) : (
                    buttonText
                )}
            </Button>
            {error && (
                <p className="text-red-500 text-xs mt-2 font-medium text-center">
                    {error}
                </p>
            )}

            <MockPaymentModal
                isOpen={mockModal.isOpen}
                onClose={() => setMockModal({ isOpen: false })}
                planName={planName}
                subscriptionId={mockModal.subscriptionId}
                token={(session as any)?.user?.accessToken || (session as any)?.accessToken}
            />
        </div>
    )
}
