"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShieldCheck, HeartPulse, LayoutDashboard, Settings, LogOut, Loader2, Camera, Activity } from "lucide-react"

export function Navbar() {
    const { data: session, status } = useSession()
    const pathname = usePathname()
    const isAdmin = (session?.user as any)?.role === "ADMIN"

    // Optional: Hide on login/signup to keep them clean
    if (pathname === "/login" || pathname === "/signup") return null

    // Determine if we should use the "Transparent/Dark" home page style or the "Light/Clean" app style
    const isHome = pathname === "/"
    const navStyle = isHome
        ? "bg-transparent border-white/5 text-white"
        : "border-b border-slate-200 bg-white/80 backdrop-blur-md text-slate-900"

    return (
        <header className={`fixed top-0 z-50 w-full transition-all duration-300 ${navStyle}`}>
            <div className="container mx-auto flex h-16 items-center justify-between px-6">

                {/* Logo with Link to Home */}
                <Link href="/" className="flex items-center space-x-2 group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ShieldCheck className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">
                        PostureHub
                    </span>
                </Link>

                {/* Primary Nav - Visible to all for discovery */}
                <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
                    <Link href="/products" className="hover:text-violet-500 transition-colors">Products</Link>
                    <Link href="/analyzer" className="hover:text-violet-500 transition-colors flex items-center space-x-1">
                        <Activity className="h-4 w-4 text-violet-500" />
                        <span>Analyzer</span>
                    </Link>
                    <Link href="/cctv" className="hover:text-violet-500 transition-colors flex items-center space-x-1">
                        <Camera className="h-4 w-4 text-violet-500" />
                        <span>CCTV</span>
                    </Link>
                    <Link href="/medical-ai" className="hover:text-violet-500 transition-colors flex items-center space-x-1">
                        <HeartPulse className="h-4 w-4 text-violet-500" />
                        <span>Medical AI</span>
                    </Link>
                    <Link href="/pricing" className="hover:text-violet-500 transition-colors">Pricing</Link>
                    <Link href="/#features" className="hover:text-violet-500 transition-colors whitespace-nowrap">Features</Link>

                    {/* Gated Links */}
                    {isAdmin && (
                        <>
                            <Link href="/dashboard" className={`flex items-center hover:text-violet-500 transition-colors ${pathname === "/dashboard" ? "text-violet-600" : ""}`}>
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Dashboard
                            </Link>
                            <Link href="/settings" className={`flex items-center hover:text-violet-500 transition-colors ${pathname === "/settings" ? "text-violet-600" : ""}`}>
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </Link>
                        </>
                    )}
                </nav>

                {/* User / Auth State */}
                <div className="flex items-center space-x-4">
                    {status === "loading" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : session ? (
                        <div className="flex items-center space-x-3">
                            <Link href="/profile" className="hidden sm:inline-block">
                                <span className={`text-sm font-bold tracking-tight px-3 py-1.5 rounded-full transition-all ${isHome ? "hover:bg-white/10 text-white" : "hover:bg-violet-100 text-slate-800 hover:text-violet-700"}`}>
                                    {session.user?.name}
                                </span>
                            </Link>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-4">
                            <Link href="/login" className="text-sm font-medium hover:text-violet-500 transition-colors">
                                Sign In
                            </Link>
                            <Link href="/signup">
                                <Button size="sm" className="bg-gradient-to-r from-violet-600 to-indigo-600 border-none shadow-md shadow-violet-500/20">
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
