"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SubscribeButtonProps {
    priceId: string
    planName: string
    className?: string
    buttonText?: string
    fallbackUrl?: string
}

export function SubscribeButton({ priceId, planName, className = "", buttonText = "Subscribe", fallbackUrl }: SubscribeButtonProps) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubscribe = async () => {
        // If the user isn't logged in, redirect them to login with a callback
        if (status === "unauthenticated" || !session) {
            router.push(fallbackUrl || `/login?callbackUrl=/pricing`)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/billing/checkout/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${(session as any)?.user?.accessToken || (session as any)?.accessToken}`,
                },
                body: JSON.stringify({ price_id: priceId }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || data.error || "Failed to create checkout session")
            }

            if (data.url) {
                // Redirect user to the Stripe Checkout page
                window.location.href = data.url
            } else {
                throw new Error("No checkout URL returned from server")
            }
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
                disabled={isLoading}
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
