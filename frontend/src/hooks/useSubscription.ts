import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { apiFetch, getApiUrl } from '@/lib/api'

export function useSubscription() {
    const { data: session, status } = useSession()
    const user = session?.user as any
    const token = user?.accessToken || (session as any)?.accessToken

    const fetchUserProfile = async () => {
        if (!token) return null
        const res = await apiFetch(getApiUrl('/api/v1/users/me/'), {
            method: "GET",
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
        currentPeriodEnd: org?.current_period_end || org?.currentPeriodEnd,
        token,
        quota,
        isFreeTier,
        hasQuotaLeft
    }
}
