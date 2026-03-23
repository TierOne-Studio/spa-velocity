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
})
