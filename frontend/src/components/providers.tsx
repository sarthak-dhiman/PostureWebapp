"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { useState } from "react"

import { ConfigProvider } from "@/context/config-context"

export function Providers({ children, config }: { children: React.ReactNode, config: any }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000, // 1 minute
            },
        },
    }))

    return (
        <ConfigProvider config={config}>
            <SessionProvider>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </SessionProvider>
        </ConfigProvider>
    )
}
