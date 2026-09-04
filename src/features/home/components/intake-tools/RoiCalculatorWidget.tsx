'use client';

import { useState } from 'react';
import { Ico } from '@/components/common/Ico';

export function RoiCalculatorWidget({
  onAddToBrief,
}: {
  onAddToBrief?: (summaryText: string) => void;
}) {
  const [employeeCount, setEmployeeCount] = useState(1);
  const [salaryPerEmployee, setSalaryPerEmployee] = useState(1200);
  const [nemoTier, setNemoTier] = useState(450); // 450 GEL/mo default

  const humanAnnualCost = employeeCount * salaryPerEmployee * 12;
  const aiAnnualCost = nemoTier * 12;
  const netAnnualSavings = Math.max(0, humanAnnualCost - aiAnnualCost);
  const savingsPercent = Math.round((netAnnualSavings / humanAnnualCost) * 100) || 0;

  const handleAppend = () => {
    const text = `ROI გაანგარიშება: ${employeeCount} თანამშრომლის ჩანაცვლება/გაძლიერება (თვიური ხელფასი: ${salaryPerEmployee} ₾). წლიური დანაზოგი: ${netAnnualSavings.toLocaleString()} ₾ (-${savingsPercent}% ხარჯების შემცირება). რეაგირების დრო: 45 წთ-დან 3 წამამდე.`;
    if (onAddToBrief) onAddToBrief(text);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-md bg-emerald-50 text-emerald-600">
            <Ico name="solar:calculator-bold-duotone" className="size-4" />
          </div>
          <span className="text-xs font-bold text-slate-900">
            ხარჯებისა და ეკონომიის კალკულატორი (ROI)
          </span>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          -{savingsPercent}% ხარჯი
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <div className="flex justify-between font-semibold text-slate-700 mb-1">
            <span>პერსონალი (ოპერატორები):</span>
            <span className="text-slate-900 font-bold">{employeeCount} ადამიანი</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={employeeCount}
            onChange={(e) => setEmployeeCount(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between font-semibold text-slate-700 mb-1">
            <span>საშუალო ხელფასი / თვე:</span>
            <span className="text-slate-900 font-bold">{salaryPerEmployee} ₾</span>
          </div>
          <input
            type="range"
            min={600}
            max={3000}
            step={100}
            value={salaryPerEmployee}
            onChange={(e) => setSalaryPerEmployee(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
        </div>
      </div>

      {/* Summary Box */}
      <div className="mt-4 rounded-xl bg-slate-50 p-3.5 border border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-500">პერსონალის ხარჯი:</span>
          <div className="text-sm font-bold text-slate-800 mt-0.5">
            {humanAnnualCost.toLocaleString()} ₾ / წელი
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase font-semibold text-slate-500">aiNOW ინვესტიცია:</span>
          <div className="text-sm font-bold text-slate-800 mt-0.5">
            {aiAnnualCost.toLocaleString()} ₾ / წელი
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-lg bg-emerald-100/60 p-1.5 border border-emerald-200">
          <span className="text-[10px] uppercase font-bold text-emerald-800">სუფთა დანაზოგი:</span>
          <div className="text-sm font-extrabold text-emerald-700 mt-0.5">
            +{netAnnualSavings.toLocaleString()} ₾
          </div>
        </div>
      </div>

      {onAddToBrief && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleAppend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            <Ico name="solar:check-circle-bold-duotone" className="size-3.5 text-emerald-400" />
            <span>გაანგარიშების ბრიფში დამატება</span>
          </button>
        </div>
      )}
    </div>
  );
}
