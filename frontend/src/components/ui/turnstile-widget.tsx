"use client"

import Turnstile from "react-turnstile"

interface TurnstileWidgetProps {
    onVerify: (token: string) => void
    onError?: () => void
}

export function TurnstileWidget({ onVerify, onError }: TurnstileWidgetProps) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""

    if (!siteKey) {
        return (
            <div className="my-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                CAPTCHA is not configured. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
            </div>
        )
    }

    return (
        <div className="flex justify-center my-4">
            <Turnstile
                sitekey={siteKey}
                onVerify={onVerify}
                onError={onError}
                theme="light"
            />
        </div>
    )
}
