import * as React from "react"
import { useLocation } from "react-router-dom"
import {
  IconBuilding,
  IconDashboard,
  IconHome,
  IconInnerShadowTop,
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
  isAdminOrManager: boolean,
  pathname: string,
  can: (resource: string, action: string) => boolean,
) => {
  const adminItems: Array<{
    title: string
    url: string
    icon: typeof IconUsers
    isActive: boolean
  }> = []

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
        isActive: pathname === "/",
        items: [
          {
            title: "Dashboard",
            url: "/",
            icon: IconDashboard,
            isActive: pathname === "/",
          },
        ],
      },
      ...(isAdminOrManager && adminItems.length > 0
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
  const { user, isAdminOrManager } = useAuth()
  const { can } = usePermissionsContext()
  const location = useLocation()
  const navItems = getNavItems(isAdminOrManager, location.pathname, can)

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
              <a href="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Admin Panel</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {isAdminOrManager && (
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
