"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react"
import { apiFetch, API_BASE_URL } from "@/lib/api"

function VerifyEmailContent() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [message, setMessage] = useState("Verifying your email address...")

    useEffect(() => {
        const uid = searchParams.get("uid")
        const token = searchParams.get("token")

        if (!uid || !token) {
            setTimeout(() => {
                setStatus("error")
                setMessage("Invalid verification link. Missing parameters.")
            }, 0)
            return
        }

        const verifyEmail = async () => {
            try {
                const baseUrl = API_BASE_URL
                const res = await apiFetch(`${baseUrl}/api/v1/auth/verify-email/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ uid, token })
                })

                const data = await res.json()

                if (res.ok) {
                    setStatus("success")
                    setMessage("Your email has been successfully verified!")
                } else {
                    setStatus("error")
                    setMessage(data.detail || "Verification failed. The link might be expired or invalid.")
                }
            } catch {
                setStatus("error")
                setMessage("A network error occurred while verifying your email.")
            }
        }

        verifyEmail()
    }, [searchParams])

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center">
                <div className="flex justify-center mb-6">
                    {status === "loading" && (
                        <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center">
                            <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                        </div>
                    )}
                    {status === "success" && (
                        <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                        </div>
                    )}
                    {status === "error" && (
                        <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center">
                            <XCircle className="h-10 w-10 text-red-500" />
                        </div>
                    )}
                </div>

                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                    {status === "loading" && "Verifying..."}
                    {status === "success" && "Email Verified!"}
                    {status === "error" && "Verification Failed"}
                </h1>

                <p className="text-slate-500 mb-8">
                    {message}
                </p>

                {status !== "loading" && (
                    <Link
                        href="/login"
                        className="inline-flex w-full items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors h-12 rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Return to Login
                    </Link>
                )}
            </div>
        </div>
    )
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                </div>
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    )
}
