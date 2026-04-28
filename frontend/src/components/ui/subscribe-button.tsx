"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch, getApiUrl } from "@/lib/api"
import { useConfig } from "@/context/config-context"
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
    const config = useConfig()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [paymentScriptLoaded, setPaymentScriptLoaded] = useState(false)
    const [showMockModal, setShowMockModal] = useState(false)
    const [lastSubscriptionId, setLastSubscriptionId] = useState<string>("")
    const allowSandbox = (typeof window !== 'undefined' && (window as any).__ALLOW_SANDBOX === 'true') || process.env.NEXT_PUBLIC_ALLOW_SANDBOX === 'true'

    // Dynamically inject the payment gateway checkout script (configurable via env)
    useEffect(() => {
        const loadScript = () => {
            const scriptId = "payment-checkout-js"
            if (document.getElementById(scriptId)) {
                setPaymentScriptLoaded(true)
                return
            }

            const sdkUrl = process.env.NEXT_PUBLIC_CASHFREE_SDK_URL || ""
            if (!sdkUrl) return

            const script = document.createElement("script")
            script.id = scriptId
            script.src = sdkUrl
            script.async = true
            script.onload = () => setPaymentScriptLoaded(true)
            script.onerror = () => {
                console.error("Failed to load payment SDK script")
                setError("Payment gateway failed to load. Please check your connection.")
            }
            document.body.appendChild(script)
        }

        loadScript()
    }, [])

    const handleSubscribe = async () => {
        // If the user isn't logged in, redirect them to login with a callback
        if (status === "unauthenticated" || !session) {
            router.push(fallbackUrl || `/login?callbackUrl=/pricing`)
            return
        }

        // If SDK not loaded yet, allow proceeding in sandbox/mock mode only
        if (!paymentScriptLoaded && !allowSandbox) {
            setError("Payment gateway is still loading. Please try again in a moment.")
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            // Step 1: Tell the backend to create a subscription (Cashfree on server)
            const res = await apiFetch(getApiUrl('/api/v1/billing/checkout/'), {
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

            // Dev/mock: backend returns cf_sub_mock_* when keys are missing or placeholder.
            if (String(data.subscription_id).startsWith("cf_sub_mock_") || String(data.subscription_id).startsWith("cf_sub_")) {
                // For sandbox/test mode, show the mock modal so developers can simulate webhook events
                setLastSubscriptionId(data.subscription_id)
                setShowMockModal(true)
                setIsLoading(false)
                return
            }

            const pubKey = config?.cashfreeAppId || process.env.NEXT_PUBLIC_CASHFREE_APP_ID || ""
            if (!pubKey) {
                // In test mode the backend may already have activated the subscription.
                throw new Error("Payment is not configured (missing NEXT_PUBLIC_CASHFREE_APP_ID).")
            }

            // If a frontend SDK is available, it should be used here to open the Cashfree checkout.
            // For now, if no SDK integration is present we fallback to reload to reflect server-side sandbox activation.
            if (!(window as any).Cashfree && !paymentScriptLoaded) {
                router.push(`/dashboard?subscription_id=${data.subscription_id}&status=success`)
                return
            }

            // TODO: Integrate actual Cashfree frontend SDK flow here when SDK and integration details are known.

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
                disabled={isLoading || (!paymentScriptLoaded && !allowSandbox)}
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


        </div>
    )
}
