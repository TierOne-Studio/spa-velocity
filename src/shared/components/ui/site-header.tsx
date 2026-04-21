import { Link, useLocation } from "react-router-dom"
import { Separator } from "@/shared/components/ui/separator"
import { SidebarTrigger } from "@/shared/components/ui/sidebar"
import { ThemeToggle } from "@/shared/components/ui/theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb"

/**
 * Route configuration for breadcrumbs
 * Follows sidebar grouping hierarchy
 */
const routeConfig: Record<string, { label: string; parent?: string }> = {
  "/": { label: "Chat", parent: "/main" },
  "/main": { label: "Main", parent: undefined },
  "/chat": { label: "Chat", parent: "/main" },
  "/projects": { label: "Projects", parent: "/main" },
  "/admin/dashboard": { label: "Admin Dashboard", parent: "/admin" },
  "/admin/users": { label: "Users", parent: "/admin" },
  "/admin/sessions": { label: "Sessions", parent: "/admin" },
  "/admin/organizations": { label: "Organizations", parent: "/admin" },
  "/admin/roles": { label: "Roles & Permissions", parent: "/admin" },
  "/admin": { label: "Admin" },
  "/settings": { label: "Settings" },
  "/account": { label: "Account" },
}

type BreadcrumbItem = { path: string; label: string; isLast: boolean }

/**
 * Normalize dynamic routes to their static config key.
 * e.g. "/chat/abc-123" -> "/chat"
 */
function normalizePath(pathname: string): string {
  if (pathname.startsWith("/chat/")) return "/chat"
  if (pathname.startsWith("/projects/")) return "/projects"
  return pathname
}

/**
 * Build breadcrumb trail from current path
 */
function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const normalized = normalizePath(pathname)
  // Get current route config
  const currentConfig = routeConfig[normalized]
  if (!currentConfig) {
    // Fallback for unknown routes — mirror the default Main > Chat landing.
    return [
      { path: "/main", label: "Main", isLast: false },
      { path: "/chat", label: "Chat", isLast: true },
    ]
  }

  // Build trail by following parent chain
  let currentPath: string | undefined = normalized
  const trail: Array<{ path: string; label: string }> = []
  
  while (currentPath) {
    const config: { label: string; parent?: string } | undefined = routeConfig[currentPath]
    if (config) {
      trail.unshift({ path: currentPath, label: config.label })
      currentPath = config.parent
    } else {
      break
    }
  }

  // Mark last item
  return trail.map((item, index) => ({
    ...item,
    isLast: index === trail.length - 1,
  }))
}

export function SiteHeader() {
  const location = useLocation()
  const breadcrumbs = buildBreadcrumbs(location.pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.flatMap((crumb, index) => [
              index > 0 ? <BreadcrumbSeparator key={`${crumb.path}-separator`} /> : null,
              <BreadcrumbItem key={crumb.path}>
                {crumb.isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.path}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>,
            ])}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
