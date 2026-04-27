"use client"

import React, { createContext, useContext, ReactNode } from "react"

interface Config {
    turnstileSiteKey: string
    razorpayKeyId: string
    razorpayBusinessPlanId: string
    // Add other public variables here if needed
}

const ConfigContext = createContext<Config | undefined>(undefined)

export function ConfigProvider({ children, config }: { children: ReactNode, config: Config }) {
    return (
        <ConfigContext.Provider value={config}>
            {children}
        </ConfigContext.Provider>
    )
}

export function useConfig() {
    const context = useContext(ConfigContext)
    return context
}
