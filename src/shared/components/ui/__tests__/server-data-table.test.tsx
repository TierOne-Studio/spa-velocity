import { useMemo, useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ColumnDef } from "@tanstack/react-table"

import { ServerDataTable } from "../server-data-table"

type TestRow = {
  id: string
  name: string
}

const initialRows: TestRow[] = [
  { id: "user-1", name: "User One" },
  { id: "user-2", name: "User Two" },
  { id: "user-3", name: "User Three" },
]

function BulkDeleteHarness() {
  const [rows, setRows] = useState(initialRows)
  const [selectedRows, setSelectedRows] = useState<TestRow[]>([])

  const columns = useMemo<ColumnDef<TestRow>[]>(() => [
    {
      id: "select",
      header: "Select",
      cell: ({ row }) => (
        <button
          aria-label={`toggle-${row.original.id}`}
          onClick={() => row.toggleSelected(!row.getIsSelected())}
          type="button"
        >
          {row.getIsSelected() ? "Selected" : "Not selected"}
        </button>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
    },
  ], [])

  return (
    <ServerDataTable
      columns={columns}
      data={rows}
      total={rows.length}
      pageSize={10}
      pageIndex={0}
      onPageChange={() => {}}
      onPageSizeChange={() => {}}
      enableRowSelection
      getRowId={(row) => row.id}
      onRowSelectionChange={setSelectedRows}
      toolbar={selectedRows.length > 0 ? (
        <button
          onClick={() => {
            const selectedIds = new Set(selectedRows.map((row) => row.id))
            setRows((currentRows) => currentRows.filter((row) => !selectedIds.has(row.id)))
            setSelectedRows([])
          }}
          type="button"
        >
          Delete ({selectedRows.length})
        </button>
      ) : null}
    />
  )
}

describe("ServerDataTable", () => {
  it("allows selecting remaining rows after previously selected rows are deleted", () => {
    render(<BulkDeleteHarness />)

    fireEvent.click(screen.getByRole("button", { name: "toggle-user-1" }))
    fireEvent.click(screen.getByRole("button", { name: "toggle-user-2" }))

    expect(screen.getByRole("button", { name: "Delete (2)" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Delete (2)" }))

    expect(screen.queryByRole("button", { name: "Delete (2)" })).not.toBeInTheDocument()
    expect(screen.queryByText("User One")).not.toBeInTheDocument()
    expect(screen.queryByText("User Two")).not.toBeInTheDocument()
    expect(screen.getByText("User Three")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "toggle-user-3" }))

    expect(screen.getByRole("button", { name: "Delete (1)" })).toBeInTheDocument()
  })
})

// ── Simple column fixture used by the additional tests ──────────────────────
const simpleColumns: ColumnDef<TestRow>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
]

const threeRows: TestRow[] = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
  { id: "3", name: "Carol" },
]

describe("ServerDataTable – additional coverage", () => {
  it("renders 'No results.' when data array is empty", () => {
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={[]}
        total={0}
        pageSize={10}
        pageIndex={0}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText("No results.")).toBeInTheDocument()
  })

  it("renders skeleton rows instead of data rows while isLoading is true", () => {
    const { container } = render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={3}
        pageSize={5}
        pageIndex={0}
        isLoading
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    // Skeleton elements should be present
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    // Actual data should NOT be rendered
    expect(screen.queryByText("Alice")).not.toBeInTheDocument()
  })

  it("calls onSearchChange when user types in the search input", () => {
    let captured = ""
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={3}
        pageSize={10}
        pageIndex={0}
        searchPlaceholder="Find…"
        searchValue=""
        onSearchChange={(v) => { captured = v }}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    const input = screen.getByPlaceholderText("Find…")
    fireEvent.change(input, { target: { value: "Bo" } })
    expect(captured).toBe("Bo")
  })

  it("calls onPageChange with pageIndex+1 when next-page button is clicked", () => {
    const onPageChange = vi.fn()
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={30}
        pageSize={10}
        pageIndex={0}
        onPageChange={onPageChange}
        onPageSizeChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /go to next page/i }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it("calls onPageChange with pageIndex-1 when previous-page button is clicked", () => {
    const onPageChange = vi.fn()
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={30}
        pageSize={10}
        pageIndex={2}
        onPageChange={onPageChange}
        onPageSizeChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /go to previous page/i }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it("calls onPageChange(0) when first-page button is clicked", () => {
    const onPageChange = vi.fn()
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={30}
        pageSize={10}
        pageIndex={2}
        onPageChange={onPageChange}
        onPageSizeChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /go to first page/i }))
    expect(onPageChange).toHaveBeenCalledWith(0)
  })

  it("calls onPageChange(last) when last-page button is clicked", () => {
    const onPageChange = vi.fn()
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={30}
        pageSize={10}
        pageIndex={0}
        onPageChange={onPageChange}
        onPageSizeChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /go to last page/i }))
    expect(onPageChange).toHaveBeenCalledWith(2) // pageCount - 1 = 3 - 1 = 2
  })

  it("calls onPageSizeChange when rows-per-page select changes", () => {
    const onPageSizeChange = vi.fn()
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={100}
        pageSize={10}
        pageIndex={0}
        onPageChange={() => {}}
        onPageSizeChange={onPageSizeChange}
      />,
    )
    // The rows-per-page select has id "rows-per-page"
    const select = screen.getByRole("combobox", { name: /rows per page/i })
    fireEvent.change(select, { target: { value: "20" } })
    expect(onPageSizeChange).toHaveBeenCalledWith(20)
  })

  it("renders toolbar when provided", () => {
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={3}
        pageSize={10}
        pageIndex={0}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        toolbar={<button type="button">Custom Action</button>}
      />,
    )
    expect(screen.getByRole("button", { name: "Custom Action" })).toBeInTheDocument()
  })

  it("disables previous/first page buttons on first page", () => {
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={30}
        pageSize={10}
        pageIndex={0}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: /go to previous page/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /go to first page/i })).toBeDisabled()
  })

  it("disables next/last page buttons on last page", () => {
    render(
      <ServerDataTable
        columns={simpleColumns}
        data={threeRows}
        total={10}
        pageSize={10}
        pageIndex={0}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: /go to next page/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /go to last page/i })).toBeDisabled()
  })
})
