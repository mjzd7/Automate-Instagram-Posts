export interface NavLinkDef {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLinkDef[] = [
  { href: "/", label: "Overview" },
  { href: "/accounts", label: "Accounts" },
  { href: "/categories", label: "Categories" },
  { href: "/templates", label: "Templates" },
  { href: "/schedules", label: "Schedules" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/series", label: "Series" },
  { href: "/config", label: "Config" },
  { href: "/analytics", label: "Analytics" },
  { href: "/history", label: "History" },
  { href: "/preview", label: "Preview" },
];
