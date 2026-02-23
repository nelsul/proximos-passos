import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Search, Check, Loader2 } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  className?: string;
  disabled?: boolean;
  /** If provided, called on each keystroke (debounced 300ms) to fetch options from backend */
  onSearch?: (query: string) => Promise<Option[]>;
}

export function SearchableSelect({
  options: initialOptions,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  className = "",
  disabled = false,
  onSearch,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [asyncOptions, setAsyncOptions] = useState<Option[] | null>(null);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Options to display: async results when available, otherwise filter locally
  const displayOptions = asyncOptions !== null
    ? asyncOptions
    : initialOptions.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      );

  const selectedOption = initialOptions.find((o) => o.value === value)
    ?? asyncOptions?.find((o) => o.value === value);

  const runSearch = useCallback(
    (query: string) => {
      if (!onSearch) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const results = await onSearch(query);
          setAsyncOptions(results);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [onSearch],
  );

  // Trigger initial load when dropdown opens (empty search = all results)
  useEffect(() => {
    if (isOpen && onSearch) {
      runSearch("");
    }
    if (!isOpen) {
      setSearch("");
      setAsyncOptions(null);
    }
  }, [isOpen, onSearch, runSearch]);

  // Trigger search on each keystroke
  useEffect(() => {
    if (isOpen && onSearch) {
      runSearch(search);
    }
  }, [search, isOpen, onSearch, runSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center justify-between rounded-lg border border-surface-border bg-background px-4 py-2.5 text-sm text-heading transition-colors hover:border-secondary focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary ${
          disabled ? "cursor-not-allowed opacity-50" : ""
        }`}
      >
        <span className={`block truncate ${!selectedOption && "text-muted"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted ml-2" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 min-w-full w-max max-w-[90vw] sm:max-w-xs md:max-w-sm rounded-lg border border-surface-border bg-surface shadow-xl shadow-black/20 origin-top overflow-hidden">
          <div className="p-2 border-b border-surface-border">
            <div className="relative flex items-center w-full">
              <Search className="absolute left-3 h-4 w-4 text-muted pointer-events-none" />
              <input
                type="text"
                autoFocus
                className="w-full min-w-0 flex-1 rounded-md border border-surface-border bg-background py-2 pl-9 pr-3 text-sm text-body outline-none placeholder:text-muted focus:border-secondary focus:ring-1 focus:ring-secondary"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searching && (
                <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-muted" />
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {searching && displayOptions.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </div>
            ) : displayOptions.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted">
                {emptyMessage}
              </div>
            ) : (
              displayOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch("");
                    setAsyncOptions(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface-light ${
                    value === option.value ? "bg-secondary/10 text-secondary" : "text-body"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
