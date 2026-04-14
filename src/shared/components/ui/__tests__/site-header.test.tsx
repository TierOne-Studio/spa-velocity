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

  it("renders Main > Chat breadcrumb for '/' route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByText("Main")).toBeInTheDocument()
    expect(screen.getByText("Chat")).toBeInTheDocument()
  })

  it("renders fallback Main > Chat for unknown routes", () => {
    render(
      <MemoryRouter initialEntries={["/some/unknown/route"]}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.getByText("Main")).toBeInTheDocument()
    expect(screen.getByText("Chat")).toBeInTheDocument()
  })

  it("renders Main > Chat breadcrumb for '/chat' and its conversation subpaths", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/chat"]}>
        <SiteHeader />
      </MemoryRouter>,
    )
    expect(screen.getByText("Main")).toBeInTheDocument()
    expect(screen.getByText("Chat")).toBeInTheDocument()

    rerender(
      <MemoryRouter initialEntries={["/chat/abc-123"]}>
        <SiteHeader />
      </MemoryRouter>,
    )
    expect(screen.getByText("Main")).toBeInTheDocument()
    expect(screen.getByText("Chat")).toBeInTheDocument()
  })

  it("renders Dashboard breadcrumb for '/dashboard' fallback route", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
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
