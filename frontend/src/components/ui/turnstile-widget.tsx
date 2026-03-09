"use client"

import { useEffect, useRef, useState } from "react"
import Turnstile, { useTurnstile } from "react-turnstile"

interface TurnstileWidgetProps {
    onVerify: (token: string) => void
    onError?: () => void
}

export function TurnstileWidget({ onVerify, onError }: TurnstileWidgetProps) {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA" // Dummy key by default

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
