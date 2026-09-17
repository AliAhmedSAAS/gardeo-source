import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Extra text used by cmdk filter (e.g. code, email, SIA). */
  keywords?: string;
};

type SearchableSelectProps = {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Shown when value is empty / matches noneValue */
  noneLabel?: string;
  /** Value used for the clear/none option. Omit to hide clear option. */
  noneValue?: string;
  "data-testid"?: string;
};

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  disabled,
  className,
  triggerClassName,
  noneLabel,
  noneValue,
  "data-testid": testId,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(() => {
    if (value == null || value === "") return null;
    if (noneValue != null && value === noneValue) {
      return { value: noneValue, label: noneLabel || "None" };
    }
    return options.find((o) => o.value === value) || null;
  }, [value, options, noneValue, noneLabel]);

  const displayLabel = selected?.label || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={testId}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            triggerClassName,
            className,
          )}
        >
          <span className="truncate text-left">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const q = search.toLowerCase().trim();
            if (!q) return 1;
            return itemValue.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {noneValue != null && (
                <CommandItem
                  value={`${noneLabel || "None"} ${noneValue}`}
                  onSelect={() => {
                    onValueChange(noneValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === noneValue ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {noneLabel || "None"}
                </CommandItem>
              )}
              {options.map((opt) => {
                const searchValue = `${opt.label} ${opt.keywords || ""} ${opt.value}`;
                return (
                  <CommandItem
                    key={opt.value}
                    value={searchValue}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
