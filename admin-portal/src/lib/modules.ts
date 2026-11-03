import { Activity, BadgeCheck, Banknote, ChartNoAxesCombined, ClipboardList, Cog, FileCheck2, Flag, LayoutDashboard, ReceiptText, ShieldCheck, Users } from 'lucide-react';
export const adminModules = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, permission: 'dashboard.read' },
  { href: '/matches', label: 'Matches & odds', icon: Flag, permission: 'matches.read' },
  { href: '/bets', label: 'All bets', icon: ReceiptText, permission: 'bets.read' },
  { href: '/settlement', label: 'Settlement', icon: BadgeCheck, permission: 'settlement.read' },
  { href: '/finance', label: 'Wallet & finance', icon: Banknote, permission: 'finance.read' },
  { href: '/users', label: 'Users & CRM', icon: Users, permission: 'users.read' },
  { href: '/kyc', label: 'KYC verification', icon: FileCheck2, permission: 'kyc.read' },
  { href: '/settings', label: 'Platform settings', icon: Cog, permission: 'settings.read' },
  { href: '/security', label: 'Security & audit', icon: ShieldCheck, permission: 'security.read' },
  { href: '/system', label: 'System health', icon: Activity, permission: 'system.read' },
] as const;
export type Permission = typeof adminModules[number]['permission'] | 'matches.write' | 'odds.write' | 'bets.inspect' | 'settlement.write' | 'finance.approve' | 'wallet.adjust' | 'users.write' | 'kyc.review' | 'settings.write' | 'security.manage';
