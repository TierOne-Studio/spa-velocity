import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"

import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { cn } from "@/shared/lib/utils"

export type MultiSelectOption = {
  value: string
  label: string
  description?: string
}

export type MultiSelectComboboxProps = {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  id?: string
  "aria-label"?: string
  "data-testid"?: string
}

export function MultiSelectCombobox({
  options,
  value,
  onChange,
  placeholder = "Select options",
  searchPlaceholder = "Search…",
  emptyMessage = "No options found.",
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const searchRef = React.useRef<HTMLInputElement | null>(null)

  const selected = React.useMemo(() => new Set(value), [value])

  const selectedOptions = React.useMemo(
    () => options.filter((o) => selected.has(o.value)),
    [options, selected],
  )

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q)),
    )
  }, [options, query])

  React.useEffect(() => {
    if (!open) return
    function onDocMouseDown(event: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocMouseDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => searchRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
    setQuery("")
  }, [open])

  function toggle(optionValue: string) {
    if (selected.has(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  function removeValue(optionValue: string, event: React.MouseEvent) {
    event.stopPropagation()
    onChange(value.filter((v) => v !== optionValue))
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
      data-testid={dataTestId}
    >
      <Button
        type="button"
        variant="outline"
        id={id}
        aria-label={ariaLabel ?? placeholder}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "w-full justify-between gap-2 min-h-9 h-auto py-1.5",
          selectedOptions.length === 0 && "text-muted-foreground",
        )}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {selectedOptions.length === 0 ? (
            <span>{placeholder}</span>
          ) : (
            selectedOptions.map((opt) => (
              <Badge
                key={opt.value}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {opt.label}
                <span
                  role="button"
                  aria-label={`Remove ${opt.label}`}
                  tabIndex={0}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => removeValue(opt.value, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onChange(value.filter((v) => v !== opt.value))
                    }
                  }}
                  className="inline-flex items-center rounded-sm hover:bg-muted-foreground/20 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </span>
              </Badge>
            ))
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </Button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="p-2 border-b">
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8"
            />
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 && (
              <li
                className="px-3 py-2 text-sm text-muted-foreground"
                role="presentation"
              >
                {emptyMessage}
              </li>
            )}
            {filtered.map((opt) => {
              const isSelected = selected.has(opt.value)
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onClick={() => toggle(opt.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      toggle(opt.value)
                    }
                  }}
                  className={cn(
                    "flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent",
                    isSelected && "bg-accent/60",
                  )}
                >
                  <span className="flex h-4 w-4 items-center justify-center mt-0.5">
                    {isSelected && <Check className="h-4 w-4" />}
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{opt.label}</span>
                    {opt.description && (
                      <span className="block text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
