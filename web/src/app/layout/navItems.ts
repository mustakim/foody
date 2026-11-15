import { History, Receipt, Scale, UserRound, Users, UtensilsCrossed, Wallet } from "lucide-react";

// adminOnly hides the link for regular users; the page itself also checks
// the role, and the Data Gateway policies are what actually enforce it.
export const navItems = [
  { href: "/", labelKey: "nav.today", icon: UtensilsCrossed, adminOnly: false },
  { href: "/balance", labelKey: "nav.balance", icon: Wallet, adminOnly: false },
  { href: "/balances", labelKey: "nav.balances", icon: Scale, adminOnly: false },
  { href: "/expenses", labelKey: "nav.expenses", icon: Receipt, adminOnly: true },
  { href: "/history", labelKey: "nav.history", icon: History, adminOnly: true },
  { href: "/members", labelKey: "nav.members", icon: Users, adminOnly: true },
  { href: "/profile", labelKey: "nav.profile", icon: UserRound, adminOnly: false }
] as const;
