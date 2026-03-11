import { useMemo, useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
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
