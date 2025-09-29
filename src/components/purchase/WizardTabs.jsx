import React from "react";
import { Rows, Boxes } from "lucide-react";

export default function WizardTabs({ step = 0, onStep }) {
  const Item = ({ i, Icon, label }) => (
    <button
      onClick={() => onStep(i)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
        step === i ? "bg-blue-600 text-white border-blue-600 shadow" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-2xl border border-gray-200">
      <Item i={0} Icon={Rows} label="PO by Supplier" />
      <Item i={1} Icon={Boxes} label="PO by Item" />
    </div>
  );
}