import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/shared/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button">Sidebar</button>,
}))

vi.mock("@/shared/components/ui/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}))

import { SiteHeader } from "../site-header"

describe("SiteHeader", () => {
  it("renders breadcrumb items without nesting list items", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(screen.getByText("Users")).toBeInTheDocument()
    expect(container.querySelectorAll("li li")).toHaveLength(0)
  })

  it("renders Dashboard breadcrumb for '/' route (single item, no separator)", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    // No separator for single item
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument()
  })

  it("renders fallback Dashboard for unknown routes", () => {
    render(
      <MemoryRouter initialEntries={["/some/unknown/route"]}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByText("Dashboard")).toBeInTheDocument()
  })

  it("renders /admin route with just Admin breadcrumb", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByText("Admin")).toBeInTheDocument()
    // Single item, no separator needed
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument()
  })

  it("renders /admin/sessions breadcrumb as Admin > Sessions", () => {
    render(
      <MemoryRouter initialEntries={["/admin/sessions"]}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(screen.getByText("Sessions")).toBeInTheDocument()
  })

  it("renders /admin/organizations breadcrumb as Admin > Organizations", () => {
    render(
      <MemoryRouter initialEntries={["/admin/organizations"]}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(screen.getByText("Organizations")).toBeInTheDocument()
  })

  it("renders /admin/roles breadcrumb as Admin > Roles & Permissions", () => {
    render(
      <MemoryRouter initialEntries={["/admin/roles"]}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(screen.getByText("Roles & Permissions")).toBeInTheDocument()
  })
})
