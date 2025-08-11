"use client";

import React, { useEffect, useRef, useState } from "react";

export interface FilterDropdownProps<T extends string = string> {
  value: T[];
  options: readonly T[];
  onChange: (value: T[]) => void;
}

export default function FilterDropdown<T extends string = string>({
  value,
  options,
  onChange,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`font-mono w-full flex items-center justify-center gap-1 rounded-[5px] border border-[rgba(150,134,18,0.19)] bg-[#FFFBF1] py-3 pr-[3px] pl-[10px]`}
      >
        <span className="text-[12px] font-normal leading-normal text-[#968612]">
          Filter{value?.length ? ` (${value.length})` : ""}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="25"
          height="25"
          viewBox="0 0 25 25"
          fill="none"
        >
          <mask
            id="mask0_2_110"
            style={{ maskType: "alpha" }}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="25"
            height="25"
          >
            <rect x="0.5" y="0.5" width="24" height="24" fill="#D9D9D9" />
          </mask>
          <g mask="url(#mask0_2_110)">
            <path d="M12.5 15.5L7.5 10.5H17.5L12.5 15.5Z" fill="#A99B3A" />
          </g>
        </svg>
      </button>

      {open && (
        <div
          className={`w-full font-mono absolute z-50 right-0 mt-2 min-w-[6rem] overflow-hidden rounded-md border border-[rgba(150,134,18,0.19)] bg-[#fefdf7]`}
        >
          <ul role="listbox">
            {options.map((opt) => {
              const isSelected = value.includes(opt);
              return (
                <li
                  key={opt}
                  id={`option-${opt}`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <button
                    type="button"
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-[#968612] hover:bg-black/5`}
                    onClick={() => {
                      const next = isSelected
                        ? value.filter((v) => v !== opt)
                        : [...value, opt];
                      onChange(next);
                    }}
                  >
                    <span
                      aria-hidden
                      className={`w-4 h-4 rounded-sm border border-[#968612] flex items-center justify-center ${
                        isSelected ? "bg-[#fae652]" : "bg-transparent"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#968612"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    {opt}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
