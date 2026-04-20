import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MultiSelectCombobox } from "../multi-select-combobox";

const options = [
  { value: "col-1", label: "General Knowledge" },
  { value: "col-2", label: "Engineering Docs", description: "Github + Confluence" },
  { value: "col-3", label: "Sales Playbooks" },
];

describe("MultiSelectCombobox", () => {
  it("renders placeholder when nothing is selected", () => {
    render(
      <MultiSelectCombobox
        options={options}
        value={[]}
        onChange={vi.fn()}
        placeholder="Pick collections"
      />,
    );

    expect(
      screen.getByRole("button", { name: /pick collections/i }),
    ).toBeInTheDocument();
  });

  it("opens the listbox and toggles a selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MultiSelectCombobox
        options={options}
        value={[]}
        onChange={onChange}
        placeholder="Pick collections"
      />,
    );

    await user.click(screen.getByRole("button", { name: /pick collections/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /general knowledge/i }));
    expect(onChange).toHaveBeenCalledWith(["col-1"]);
  });

  it("filters options by search query", async () => {
    const user = userEvent.setup();
    render(
      <MultiSelectCombobox
        options={options}
        value={[]}
        onChange={vi.fn()}
        placeholder="Pick"
      />,
    );

    await user.click(screen.getByRole("button", { name: /pick/i }));
    await user.type(screen.getByPlaceholderText(/search/i), "engineering");

    expect(
      screen.getByRole("option", { name: /engineering docs/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /general knowledge/i }),
    ).not.toBeInTheDocument();
  });

  it("renders selected options as chips and removes them", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <MultiSelectCombobox
        options={options}
        value={["col-1", "col-2"]}
        onChange={onChange}
        placeholder="Pick"
      />,
    );

    expect(screen.getByText("General Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Engineering Docs")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /remove general knowledge/i }),
    );
    expect(onChange).toHaveBeenCalledWith(["col-2"]);
  });

  it("shows an empty-state message when no options match", async () => {
    const user = userEvent.setup();
    render(
      <MultiSelectCombobox
        options={options}
        value={[]}
        onChange={vi.fn()}
        placeholder="Pick"
        emptyMessage="Nothing to see"
      />,
    );

    await user.click(screen.getByRole("button", { name: /pick/i }));
    await user.type(screen.getByPlaceholderText(/search/i), "zzzzz");

    expect(screen.getByText(/nothing to see/i)).toBeInTheDocument();
  });
});
