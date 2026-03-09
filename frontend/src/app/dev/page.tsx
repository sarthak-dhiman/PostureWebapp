'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import {
    Activity, DollarSign, Users, ShieldAlert, Terminal, MessageSquare, ChevronRight,
    RefreshCcw, ArrowUpRight, LayoutDashboard, HardDrive, AlertCircle, Inbox
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const ROLE_COLORS: Record<string, string> = {
    SOLO: '#6366f1',
    ADMIN: '#a855f7',
    EMPLOYEE: '#ec4899',
};

export default function DevPortal() {
    const { data: session, status: sessionStatus } = useSession();
    const token = (session?.user as any)?.accessToken || (session as any)?.accessToken;

    const [activeTab, setActiveTab] = useState('metrics');
    const [metrics, setMetrics] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [tickets, setTickets] = useState<any[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);

    const authFetch = useCallback((path: string) =>
        apiFetch(`${API_BASE}${path}`, {
            headers: { Authorization: `Bearer ${token}` }
        }), [token]);

    const fetchMetrics = useCallback(async () => {
        const res = await authFetch('/api/v1/dev/metrics/');
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
    }, [authFetch]);

    const fetchLogs = useCallback(async () => {
        const res = await authFetch('/api/v1/dev/logs/?type=audit&limit=50');
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
    }, [authFetch]);

    const fetchTickets = useCallback(async () => {
        const res = await authFetch('/api/v1/dev/support/');
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
    }, [authFetch]);

    const loadAll = useCallback(async () => {
        if (!token) return;
        setError(null);
        try {
            const [m, l, t] = await Promise.all([fetchMetrics(), fetchLogs(), fetchTickets()]);
            setMetrics(m);
            setLogs(l);
            setTickets(t);
        } catch (e: any) {
            setError(e.message || 'Failed to load. Are you logged in as superuser?');
        } finally {
            setIsLoading(false);
        }
    }, [token, fetchMetrics, fetchLogs, fetchTickets]);

    useEffect(() => {
        if (sessionStatus === 'authenticated' && token) {
            loadAll();
        } else if (sessionStatus === 'unauthenticated') {
            setError('Please log in as a superuser to access the Dev Console.');
            setIsLoading(false);
        }
    }, [sessionStatus, token, loadAll]);

    const refreshData = async () => {
        setIsRefreshing(true);
        await loadAll();
        setTimeout(() => setIsRefreshing(false), 800);
    };

    const demographics = useMemo(() => {
        if (!metrics?.users?.roles) return [];
        return Object.entries(metrics.users.roles).map(([role, count]) => ({
            name: role,
            value: count as number,
            color: ROLE_COLORS[role] || '#64748b',
        }));
    }, [metrics]);

    const errorCount = metrics?.system_health?.errors_24h ?? 0;
    const hasErrors = typeof errorCount === 'number' && errorCount > 0;
    const auditCount = metrics?.system_health?.audit_events_24h ?? '—';
    const openTickets = tickets.filter(t => t.status === 'OPEN').length;

    return (
        /* Offset by h-16 (navbar height) so sidebar & content clear the fixed navbar */
        <div className="min-h-screen bg-[#0f1115] text-white font-sans selection:bg-indigo-500/30 pt-16">

            {/* ─── SIDEBAR (starts below the 64px navbar) ─── */}
            <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-60 border-r border-white/5 bg-[#14171d]/70 backdrop-blur-xl z-40 flex flex-col">
                <div className="p-6 flex-1">
                    {/* Branding */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-black tracking-tight leading-none">DEV<span className="text-indigo-500 ml-1">CONSOLE</span></h2>
                            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Superuser Portal</p>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="space-y-1">
                        {[
                            { id: 'metrics', icon: LayoutDashboard, label: 'Metrics' },
                            { id: 'logs', icon: Terminal, label: 'System Logs' },
                            { id: 'support', icon: MessageSquare, label: `Support (${openTickets})` },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === item.id
                                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                                    }`}
                            >
                                <item.icon size={17} />
                                <span>{item.label}</span>
                                {activeTab === item.id && (
                                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Status pill */}
                <div className="p-5 border-t border-white/5">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
                        <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">System Status</p>
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${hasErrors ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
                            <span className="text-xs font-bold text-gray-300">
                                {hasErrors ? `${errorCount} active errors` : 'All systems nominal'}
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-600 font-mono">{auditCount} audit events today</p>
                    </div>
                </div>
            </aside>

            {/* ─── MAIN CONTENT ─── */}
            <main className="ml-60 px-8 py-8 min-h-[calc(100vh-64px)]">

                {/* Page Header */}
                <header className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight">Developer Portal</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Live infrastructure metrics, logs, and support queue.</p>
                    </div>
                    <button
                        onClick={refreshData}
                        title="Refresh all data"
                        className={`p-2.5 rounded-xl border border-white/5 bg-[#14171d] hover:bg-white/5 transition-all text-gray-400 hover:text-white ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`}
                    >
                        <RefreshCcw size={18} />
                    </button>
                </header>

                {/* Error banner */}
                {error && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400">
                        <AlertCircle size={16} className="shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                {/* Loading skeleton */}
                {isLoading && (
                    <div className="grid grid-cols-4 gap-5 animate-pulse">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-28 rounded-2xl bg-white/5" />
                        ))}
                    </div>
                )}

                {/* ═══ METRICS TAB ═══ */}
                {!isLoading && activeTab === 'metrics' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* KPI Cards — 4 columns */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                            {[
                                {
                                    label: 'Total Revenue',
                                    value: metrics ? `₹${Number(metrics.revenue?.total || 0).toLocaleString('en-IN')}` : '₹0',
                                    sub: `Currency: ${metrics?.revenue?.currency || 'INR'}`,
                                    icon: DollarSign,
                                    color: 'from-blue-500 to-indigo-600',
                                },
                                {
                                    label: 'MRR (30d)',
                                    value: metrics ? `₹${Number(metrics.revenue?.monthly || 0).toLocaleString('en-IN')}` : '₹0',
                                    sub: 'Last 30 days',
                                    icon: RefreshCcw,
                                    color: 'from-purple-500 to-pink-600',
                                },
                                {
                                    label: 'Active Subscriptions',
                                    value: metrics?.subscriptions?.active ?? 0,
                                    sub: `${(metrics?.subscriptions?.conversion_rate || 0).toFixed(1)}% conversion`,
                                    icon: HardDrive,
                                    color: 'from-emerald-500 to-teal-600',
                                },
                                {
                                    label: 'Total Users',
                                    value: metrics?.users?.total ?? 0,
                                    sub: `+${metrics?.users?.growth_30d ?? 0} this month`,
                                    icon: Users,
                                    color: 'from-orange-500 to-amber-600',
                                },
                            ].map((kpi, idx) => (
                                <div key={idx} className="group relative p-5 rounded-2xl bg-[#14171d] border border-white/5 hover:border-white/10 transition-all overflow-hidden shadow-lg shadow-black/30">
                                    <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${kpi.color} opacity-[0.04] group-hover:opacity-[0.08] transition-opacity rounded-full blur-2xl`} />
                                    <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${kpi.color} shadow-md mb-3`}>
                                        <kpi.icon className="w-4 h-4 text-white" />
                                    </div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">{kpi.label}</p>
                                    <p className="text-xl font-black tracking-tight">{kpi.value}</p>
                                    <p className="text-[10px] text-gray-600 mt-1">{kpi.sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* Charts Row — Demographics + System Health */}
                        <div className="grid grid-cols-2 gap-6">
                            {/* User Demographics Donut */}
                            <div className="p-6 rounded-2xl bg-[#14171d] border border-white/5 shadow-lg shadow-black/30">
                                <h3 className="text-sm font-bold mb-1">User Demographics</h3>
                                <p className="text-[11px] text-gray-500 mb-5">Role distribution across all users</p>
                                {demographics.length > 0 ? (
                                    <>
                                        <div className="h-[180px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={demographics}
                                                        cx="50%" cy="50%"
                                                        innerRadius={52} outerRadius={75}
                                                        paddingAngle={6}
                                                        dataKey="value"
                                                    >
                                                        {demographics.map((d, i) => (
                                                            <Cell key={i} fill={d.color} stroke="none" />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ background: '#1c1f26', borderRadius: 10, border: '1px solid #ffffff10', color: '#fff', fontSize: 12 }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex justify-center gap-5 mt-3">
                                            {demographics.map((d) => (
                                                <div key={d.name} className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{d.name} <span className="text-gray-600">({d.value})</span></span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[180px] flex items-center justify-center text-gray-600 text-sm">No role data yet.</div>
                                )}
                            </div>

                            {/* System Health Bars */}
                            <div className="p-6 rounded-2xl bg-[#14171d] border border-white/5 shadow-lg shadow-black/30">
                                <h3 className="text-sm font-bold mb-1">System Health <span className="text-gray-600 font-normal">(24h)</span></h3>
                                <p className="text-[11px] text-gray-500 mb-5">Real-time operational metrics</p>
                                <div className="space-y-5">
                                    {[
                                        { label: 'Audit Events', value: metrics?.system_health?.audit_events_24h ?? 0, color: 'bg-indigo-500', max: 500 },
                                        { label: 'Error Logs', value: metrics?.system_health?.errors_24h ?? 0, color: 'bg-red-500', max: 50 },
                                        { label: 'Active Orgs', value: metrics?.subscriptions?.active ?? 0, color: 'bg-emerald-500', max: Math.max(metrics?.subscriptions?.total_orgs || 1, 1) },
                                        { label: 'New Users (30d)', value: metrics?.users?.growth_30d ?? 0, color: 'bg-amber-500', max: Math.max(metrics?.users?.total || 1, 1) },
                                    ].map((bar) => {
                                        const pct = Math.min(100, (bar.value / bar.max) * 100);
                                        return (
                                            <div key={bar.label} className="space-y-1.5">
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-gray-400 font-semibold">{bar.label}</span>
                                                    <span className="font-bold text-gray-200">{bar.value}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                                    <div className={`h-full ${bar.color} opacity-75 transition-all duration-700 rounded-full`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Recent Audit Events */}
                        <div className="p-6 rounded-2xl bg-[#14171d] border border-white/5 shadow-lg shadow-black/30">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold">Recent Audit Events</h3>
                                <button
                                    onClick={() => setActiveTab('logs')}
                                    className="flex items-center gap-1 text-[11px] text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
                                >
                                    View all <ChevronRight size={14} />
                                </button>
                            </div>
                            {logs.length === 0 ? (
                                <p className="text-center py-8 text-gray-600 text-sm">No audit events recorded yet.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {logs.slice(0, 6).map((log, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.06] transition-all">
                                            <div className={`p-1.5 rounded-lg shrink-0 ${log.action?.includes('DELETE') ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                <ShieldAlert size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold truncate">{log.description || log.action}</p>
                                                <p className="text-[10px] text-gray-600 mt-0.5">{log.actor} · {new Date(log.created_at).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ LOGS TAB ═══ */}
                {!isLoading && activeTab === 'logs' && (
                    <div className="animate-in slide-in-from-right-5 duration-400">
                        <div className="bg-[#14171d] rounded-2xl border border-white/5 overflow-hidden shadow-2xl shadow-black/50" style={{ height: 'calc(100vh - 200px)' }}>
                            {/* Terminal Title Bar */}
                            <div className="flex items-center justify-between px-6 py-3 bg-black/30 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                                    <span className="ml-4 text-xs font-mono text-gray-500">audit-log --stream --limit=50</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono text-gray-600">{logs.length} events</span>
                                    <button onClick={refreshData} className="text-gray-600 hover:text-white transition-colors p-1">
                                        <RefreshCcw size={13} />
                                    </button>
                                </div>
                            </div>
                            {/* Log output */}
                            <div className="h-[calc(100%-45px)] overflow-y-auto p-6 font-mono text-xs space-y-2 custom-scrollbar">
                                {logs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-2">
                                        <Terminal size={28} />
                                        <p>No audit logs found.</p>
                                    </div>
                                ) : logs.map((log, idx) => (
                                    <div key={idx} className="flex gap-3 group hover:bg-white/[0.02] -mx-2 px-2 py-0.5 rounded transition-colors">
                                        <span className="text-gray-700 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                                        <span className={`shrink-0 font-bold ${log.action?.includes('DELETE') ? 'text-red-400' : 'text-indigo-400'}`}>{log.action}</span>
                                        <span className="text-gray-400 break-all">{log.description}</span>
                                        <span className="ml-auto text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">@{log.actor}</span>
                                    </div>
                                ))}
                                <div className="flex items-center gap-1 pt-2">
                                    <span className="text-indigo-600">$</span>
                                    <span className="w-1.5 h-3.5 bg-indigo-500/40 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ SUPPORT TAB ═══ */}
                {!isLoading && activeTab === 'support' && (
                    <div className="grid grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-400" style={{ height: 'calc(100vh - 200px)' }}>
                        {/* Ticket Queue */}
                        <div className="bg-[#14171d] rounded-2xl border border-white/5 overflow-hidden flex flex-col shadow-lg shadow-black/30">
                            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                                <h3 className="text-sm font-bold">Support Queue</h3>
                                <span className="bg-indigo-500/20 text-indigo-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    {openTickets} open
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {tickets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-2 py-10">
                                        <Inbox size={24} />
                                        <p className="text-xs">No tickets yet</p>
                                    </div>
                                ) : tickets.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTicket(t)}
                                        className={`w-full text-left p-4 rounded-xl border transition-all ${selectedTicket?.id === t.id
                                            ? 'bg-indigo-500/10 border-indigo-500/30'
                                            : 'bg-white/[0.03] border-transparent hover:border-indigo-500/20 hover:bg-white/[0.06]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{t.category}</span>
                                            <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'OPEN' ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
                                        </div>
                                        <h4 className="text-xs font-bold truncate mb-1">{t.subject}</h4>
                                        <div className="flex justify-between text-[10px] text-gray-600">
                                            <span>{t.user}</span>
                                            <span>{new Date(t.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Ticket Detail */}
                        <div className="col-span-2 bg-[#14171d] rounded-2xl border border-white/5 overflow-hidden flex flex-col shadow-lg shadow-black/30">
                            {selectedTicket ? (
                                <>
                                    <div className="px-6 py-5 border-b border-white/5 shrink-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="font-bold text-base leading-tight">{selectedTicket.subject}</h3>
                                                <p className="text-[11px] text-gray-500 mt-1">
                                                    From <span className="text-gray-300 font-semibold">{selectedTicket.user}</span>
                                                    {' · '}{selectedTicket.category}
                                                    {' · '}{new Date(selectedTicket.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${selectedTicket.status === 'OPEN' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-gray-700/50 text-gray-500'}`}>
                                                {selectedTicket.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                        {selectedTicket.last_message ? (
                                            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
                                                <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-3">Latest Message</p>
                                                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedTicket.last_message}</p>
                                            </div>
                                        ) : (
                                            <p className="text-gray-600 text-sm">No messages yet.</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-5">
                                        <MessageSquare size={28} className="text-indigo-400" />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2">Select a ticket</h3>
                                    <p className="text-sm text-gray-600 max-w-xs">Choose a ticket from the queue to view details and respond.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
