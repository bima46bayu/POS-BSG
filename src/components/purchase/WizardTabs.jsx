// src/components/purchase/WizardTabs.jsx
import React from "react";
import { Rows, Boxes } from "lucide-react";

export default function WizardTabs({ step = 0, onStep }) {
  const items = [
    { i: 0, label: "PO by Supplier", Icon: Rows },
    { i: 1, label: "PO by Item", Icon: Boxes },
  ];

  return (
    <div className="w-full md:w-auto">
      <div
        className="rounded-lg p-1.5 border border-gray-200 bg-gradient-to-b from-gray-100 to-gray-50"
      >
        {/* grid 2 kolom agar lebar tombol sama */}
        <div className="grid grid-cols-2 gap-1.5 min-w-[320px] md:min-w-[420px]">
          {items.map(({ i, label, Icon }) => {
            const active = step === i;
            return (
              <button
                key={i}
                onClick={() => onStep?.(i)}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 h-10
                  text-sm font-medium transition-all border
                  ${
                    active
                      ? "bg-white text-blue-600 border-blue-300 shadow-md"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-blue-600"
                  }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    active ? "text-blue-600" : "text-gray-500"
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
