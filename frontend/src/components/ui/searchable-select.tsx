import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

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
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  className = "",
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

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
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch("");
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
