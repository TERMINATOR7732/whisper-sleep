import { Activity, BarChart3, BedDouble, Heart, Home, MessageCircle, RotateCcw, Sparkles, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AppRole } from "@/types/db";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const USER_NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/check-in", label: "Check-in", icon: BedDouble },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/reset", label: "Reset", icon: RotateCcw },
  { to: "/profile", label: "Profile", icon: User },
];

export const PARTNER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Heart },
  { to: "/trends", label: "Trends", icon: BarChart3 },
  { to: "/patterns", label: "Patterns", icon: Activity },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
];

export function navFor(role: AppRole): NavItem[] {
  return role === "partner" ? PARTNER_NAV : USER_NAV;
}

export function homeFor(role: AppRole): "/home" | "/dashboard" {
  return role === "partner" ? "/dashboard" : "/home";
}
