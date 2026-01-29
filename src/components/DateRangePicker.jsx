import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const todayStr = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, onClose }) {
  const [month, setMonth] = useState(() => {
    const d = new Date(startDate || endDate || todayStr());
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [hoverDate, setHoverDate] = useState(null);

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(month.year, month.month);
  const firstDay = getFirstDayOfMonth(month.year, month.month);
  const days = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const formatDate = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const dateToString = (dateStr) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const isInRange = (day) => {
    if (!day) return false;
    const d = new Date(month.year, month.month, day);
    const dStr = formatDate(d);
    const start = dateToString(startDate);
    const end = dateToString(endDate);
    
    if (!start || !end) return false;
    return d >= start && d <= end;
  };

  const isSelected = (day) => {
    if (!day) return false;
    const d = new Date(month.year, month.month, day);
    const dStr = formatDate(d);
    return dStr === startDate || dStr === endDate;
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const d = new Date(month.year, month.month, day);
    const dStr = formatDate(d);
    
    if (!startDate || (startDate && endDate)) {
      onStartChange(dStr);
      onEndChange("");
    } else {
      const start = dateToString(startDate);
      if (d < start) {
        onEndChange(startDate);
        onStartChange(dStr);
      } else {
        onEndChange(dStr);
      }
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => {
    setMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 });
  };

  const nextMonth = () => {
    setMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 });
  };

  const handleThisWeek = () => {
    const today = new Date();
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
    const lastDay = new Date(today.setDate(today.getDate() + 6));
    
    onStartChange(formatDate(firstDay));
    onEndChange(formatDate(lastDay));
  };

  const handleThisMonth = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    onStartChange(formatDate(firstDay));
    onEndChange(formatDate(lastDay));
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[300px] md:w-[340px] lg:w-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h3 className="font-semibold text-gray-900 text-sm tracking-wide">
          {monthNames[month.month]} {month.year}
        </h3>

        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 text-xs text-gray-500 mb-1">
        {dayNames.map(d => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>

      {/* Calendar */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;

          const dStr = formatDate(new Date(month.year, month.month, day));
          const inRange = isInRange(day);
          const selected = isSelected(day);
          const isStart = dStr === startDate;
          const isEnd = dStr === endDate;

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className={`
                h-9 text-sm flex items-center justify-center transition
                ${selected ? "bg-blue-600 text-white font-semibold" : ""}
                ${inRange && !selected ? "bg-blue-100 text-blue-900" : ""}
                ${!inRange && !selected ? "hover:bg-gray-100 text-gray-800" : ""}
                ${isStart ? "rounded-l-full" : ""}
                ${isEnd ? "rounded-r-full" : ""}
                ${!isStart && !isEnd ? "rounded-md" : ""}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Preset Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleThisWeek}
          className="flex-1 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-full transition"
        >
          Minggu Ini
        </button>
        <button
          onClick={handleThisMonth}
          className="flex-1 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-full transition"
        >
          Bulan Ini
        </button>
      </div>

      {/* Date Inputs */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 border rounded-lg px-2 py-1 bg-gray-50 text-center text-xs">
          {startDate || "Start"}
        </div>
        <div className="flex-1 border rounded-lg px-2 py-1 bg-gray-50 text-center text-xs">
          {endDate || "End"}
        </div>
      </div>

      {/* Apply */}
      <button
        onClick={onClose}
        className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
      >
        Apply
      </button>
    </div>
  );
}
