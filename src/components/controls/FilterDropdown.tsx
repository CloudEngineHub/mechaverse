"use client";

import React, { useEffect, useRef, useState } from "react";
import { DM_Mono } from "next/font/google";

const dmMono = DM_Mono({ subsets: ["latin"], weight: "400" });

export interface FilterDropdownProps<T extends string = string> {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  className?: string;
}

export default function FilterDropdown<T extends string = string>({
  value,
  options,
  onChange,
  className,
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
        className={`${dmMono.className} ${
          className ?? ""
        } w-full flex items-center justify-center gap-1 rounded-[5px] border border-[rgba(150,134,18,0.19)] bg-[#FFFBF1] py-3 pr-[3px] pl-[10px]`}
      >
        <span className="text-[12px] font-normal leading-normal text-[#968612]">
          Filter
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
          className={`${dmMono.className} ${
            className ?? ""
          } absolute z-50 right-0 mt-2 min-w-[6rem] overflow-hidden rounded-md border border-[rgba(150,134,18,0.19)] bg-[#fefdf7] shadow-md`}
        >
          <ul role="listbox" aria-activedescendant={`option-${value}`}>
            {options.map((opt) => (
              <li
                key={opt}
                id={`option-${opt}`}
                role="option"
                aria-selected={opt === value}
              >
                <button
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm text-[#968612] ${
                    opt === value ? "bg-[#ffb601]/80" : "hover:bg-black/5"
                  }`}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
