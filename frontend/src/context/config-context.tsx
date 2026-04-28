"use client"

import React, { createContext, useContext, ReactNode } from "react"

interface Config {
    cashfreeAppId: string
    cashfreeSdkUrl?: string
    cashfreeBusinessPlanId: string
    cashfreePlanWebcamMo?: string
    cashfreePlanWebcamQtr?: string
    cashfreePlanWebcamYr?: string
    cashfreePlanHealthMo?: string
    cashfreePlanHealthQtr?: string
    cashfreePlanHealthYr?: string
    cashfreePlanComboMo?: string
    cashfreePlanComboQtr?: string
    cashfreePlanComboYr?: string
    allowSandbox?: boolean
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
