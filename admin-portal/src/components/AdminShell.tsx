'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronDown, Menu, Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { adminModules } from '@/lib/modules';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const links = adminModules.filter(m => m.label.toLowerCase().includes(search.toLowerCase()));
  return <div className="min-h-screen md:flex">
    <aside className={`${collapsed ? 'md:w-[76px]' : 'md:w-[255px]'} w-full shrink-0 bg-brand-950 text-white transition-all`}>
      <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-5">
        {!collapsed && <Link href="/dashboard" className="text-lg font-black tracking-wide">BET<span className="text-emerald-300">ZONE</span><span className="ml-2 text-xs font-medium text-emerald-100">ADMIN</span></Link>}
        <button aria-label="Collapse navigation" onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-2 hover:bg-white/10"><Menu size={20}/></button>
      </div>
      <nav className="space-y-1 p-3">
        {adminModules.map(item => { const Icon = item.icon; const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} title={item.label} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${active ? 'bg-emerald-400 font-bold text-brand-950' : 'text-emerald-50/80 hover:bg-white/10'}`}><Icon size={19}/>{!collapsed && <span>{item.label}</span>}</Link>; })}
      </nav>
      {!collapsed && <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-emerald-100/80"><ShieldCheck size={17} className="mb-2 text-emerald-300"/>Administrative actions must be permission-checked and audited by the backend.</div>}
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-10 flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8">
        <div><div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Operations center</div><div className="text-sm text-slate-500">BETZONE · Administration</div></div>
        <div className="flex items-center gap-2 sm:gap-4"><label className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex"><Search size={16} className="text-slate-400"/><input aria-label="Search admin modules" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a module..." className="w-36 bg-transparent text-sm outline-none"/></label><button aria-label="Notifications" className="rounded-xl border border-slate-200 p-2 text-slate-600"><Bell size={18}/></button><button className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 font-bold text-brand-900">A</span><span className="hidden sm:inline">Administrator</span><ChevronDown size={15}/></button></div>
      </header>
      {search && <div className="border-b bg-white px-4 py-3 md:px-8"><div className="flex flex-wrap gap-2">{links.map(item => <Link key={item.href} href={item.href} onClick={() => setSearch('')} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{item.label}</Link>)}{!links.length && <span className="text-sm text-slate-500">No matching modules.</span>}</div></div>}
      <div className="mx-auto w-full max-w-[1600px] p-4 md:p-8">{children}</div>
    </main>
  </div>;
}
