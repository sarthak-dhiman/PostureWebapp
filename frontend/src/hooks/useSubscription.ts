import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'

export function useSubscription() {
    const { data: session, status } = useSession()
    const user = session?.user as any
    const token = user?.accessToken || (session as any)?.accessToken

    const fetchUserProfile = async () => {
        if (!token) return null
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/users/me/`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) throw new Error("Failed to fetch user profile")
        return res.json()
    }

    const { data: profile, isLoading: isProfileLoading } = useQuery({
        queryKey: ["userProfile", user?.id],
        queryFn: fetchUserProfile,
        enabled: !!token,
        staleTime: 60000,
    })

    const isLoading = status === "loading" || (status === "authenticated" && isProfileLoading)

    // Role and org details fallback to session if live data hasn't loaded yet
    const role = profile?.role || user?.role || "SOLO"
    const isSolo = role === "SOLO"
    const isAdmin = role === "ADMIN"
    const isEmployee = role === "EMPLOYEE"

    // Org Details
    const org = profile?.organization || user?.organization
    const orgName = org?.name

    // True Subscription status - checks both casing just in case (has_subscription from API, hasSubscription from Session)
    const hasSubscription = org?.has_subscription || org?.hasSubscription || false

    // Quota Details
    const quota = profile?.quota || user?.quota
    const isFreeTier = quota?.is_free_tier ?? true
    const quotaRemaining = quota?.quota_remaining_seconds ?? 0
    const hasQuotaLeft = !isFreeTier || quotaRemaining > 0

    return {
        user: profile || user,
        sessionStatus: status,
        isLoading,
        role,
        isSolo,
        isAdmin,
        isEmployee,
        org,
        orgName,
        hasSubscription,
        token,
        quota,
        isFreeTier,
        hasQuotaLeft
    }
}
