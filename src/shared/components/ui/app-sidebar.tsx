import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
  IconBooks,
  IconBrain,
  IconBuilding,
  IconChartBar,
  IconCode,
  IconDatabase,
  IconHome,
  IconInnerShadowTop,
  IconLibrary,
  IconMessageCircle,
  IconShield,
  IconUsers,
  IconUserScan,
} from "@tabler/icons-react"

import { NavMain } from "@/shared/components/ui/nav-main"
import { NavSecondary } from "@/shared/components/ui/nav-secondary"
import { NavUser } from "@/shared/components/ui/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/shared/components/ui/sidebar"
import { OrganizationSwitcher } from "@/shared/components/OrganizationSwitcher"
import { useAuth } from "@/shared/context/AuthContext"
import { usePermissionsContext } from "@/shared/context/PermissionsContext"

// Navigation configuration
const getNavItems = (
  pathname: string,
  can: (resource: string, action: string) => boolean,
) => {
  const adminItems: Array<{
    title: string
    url: string
    icon: typeof IconUsers
    isActive: boolean
  }> = []

  if (can("dashboard", "view")) {
    adminItems.push({
      title: "Dashboard",
      url: "/admin/dashboard",
      icon: IconChartBar,
      isActive: pathname.startsWith("/admin/dashboard"),
    })
  }

  if (can("user", "read")) {
    adminItems.push({
      title: "Users",
      url: "/admin/users",
      icon: IconUsers,
      isActive: pathname.startsWith("/admin/users"),
    })
  }

  if (can("session", "read")) {
    adminItems.push({
      title: "Sessions",
      url: "/admin/sessions",
      icon: IconUserScan,
      isActive: pathname === "/admin/sessions",
    })
  }

  if (can("organization", "read")) {
    adminItems.push({
      title: "Organizations",
      url: "/admin/organizations",
      icon: IconBuilding,
      isActive: pathname.startsWith("/admin/organizations"),
    })
  }

  if (can("role", "read")) {
    adminItems.push({
      title: "Roles & Permissions",
      url: "/admin/roles",
      icon: IconShield,
      isActive: pathname === "/admin/roles",
    })
  }

  return {
    navMain: [],
    navGroups: [
      {
        title: "Main",
        icon: IconHome,
        isActive:
          pathname === "/" ||
          pathname.startsWith("/chat") ||
          pathname.startsWith("/projects") ||
          pathname.startsWith("/collections") ||
          pathname.startsWith("/sql-connections") ||
          pathname.startsWith("/vector-dbs") ||
          pathname.startsWith("/embed-sites"),
        items: [
          ...(can("chat", "read")
            ? [
                {
                  title: "Chat",
                  url: "/chat",
                  icon: IconMessageCircle,
                  isActive: pathname.startsWith("/chat"),
                },
              ]
            : []),
          ...(can("project", "read")
            ? [
                {
                  title: "Projects",
                  url: "/projects",
                  icon: IconBooks,
                  isActive: pathname.startsWith("/projects"),
                },
              ]
            : []),
          // ADR-011 amendment 5 + UX promotion: collections move from Admin
          // to Main; the page is the same component, the nav slot shifts.
          ...(can("airweave", "read")
            ? [
                {
                  title: "Collections",
                  url: "/collections",
                  icon: IconLibrary,
                  isActive: pathname.startsWith("/collections"),
                },
              ]
            : []),
          // ADR-012: SQL connections promoted from embedded Edit-Org modal
          // section to a first-class Main page. Gated on the new permission.
          ...(can("sql-connection", "read")
            ? [
                {
                  title: "SQL Connections",
                  url: "/sql-connections",
                  icon: IconDatabase,
                  isActive: pathname.startsWith("/sql-connections"),
                },
              ]
            : []),
          ...(can("vector-db", "read")
            ? [
                {
                  title: "Vector Databases",
                  url: "/vector-dbs",
                  icon: IconBrain,
                  isActive: pathname.startsWith("/vector-dbs"),
                },
              ]
            : []),
          ...(can("embed-site", "read")
            ? [
                {
                  title: "Public Widget",
                  url: "/embed-sites",
                  icon: IconCode,
                  isActive: pathname.startsWith("/embed-sites"),
                },
              ]
            : []),
        ],
      },
      ...(adminItems.length > 0
        ? [
            {
              title: "Admin",
              icon: IconShield,
              isActive: pathname.startsWith("/admin"),
              items: adminItems,
            },
          ]
        : []),
    ],
    navSecondary: [],
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const { can } = usePermissionsContext()
  const location = useLocation()
  const navItems = getNavItems(location.pathname, can)

  const userData = {
    name: user?.name ?? "User",
    email: user?.email ?? "",
    avatar: user?.image ?? "",
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Velocity</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {user && (
          <SidebarGroup>
            <SidebarGroupLabel>Organization</SidebarGroupLabel>
            <div className="px-2">
              <OrganizationSwitcher />
            </div>
          </SidebarGroup>
        )}
        <NavMain items={navItems.navMain} groups={navItems.navGroups} />
        <NavSecondary items={navItems.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
