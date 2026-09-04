'use client';

import { Ico } from '@/components/common/Ico';

interface SmartBranchingChipsProps {
  onSelectChip: (chipText: string) => void;
}

interface ChipItem {
  label: string;
  icon: string;
}

export function SmartBranchingChips({ onSelectChip }: SmartBranchingChipsProps) {
  const chipGroups: Array<{ category: string; items: ChipItem[] }> = [
    {
      category: 'ბიუჯეტი',
      items: [
        { label: '500₾ - 1,500₾', icon: 'solar:wallet-money-bold-duotone' },
        { label: '1,500₾ - 5,000₾', icon: 'solar:wallet-money-bold-duotone' },
        { label: '5,000₾+', icon: 'solar:wallet-money-bold-duotone' },
      ],
    },
    {
      category: 'პრიორიტეტული არხი',
      items: [
        { label: 'WhatsApp & Instagram', icon: 'solar:chat-round-line-bold-duotone' },
        { label: 'სატელეფონო ზარები', icon: 'solar:phone-bold-duotone' },
        { label: 'ყველა არხი ერთად', icon: 'solar:global-bold-duotone' },
      ],
    },
    {
      category: 'მიზანი',
      items: [
        { label: 'მეტი გაყიდვა', icon: 'solar:rocket-bold-duotone' },
        { label: '24/7 მომსახურება', icon: 'solar:bolt-bold-duotone' },
        { label: 'რუტინის შემცირება', icon: 'solar:graph-down-bold-duotone' },
      ],
    },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 space-y-2.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        დააზუსტეთ ბრიფის დეტალები 1 კლიკით:
      </div>
      <div className="flex flex-wrap gap-2">
        {chipGroups.flatMap((group) =>
          group.items.map((item, idx) => (
            <button
              key={`${group.category}-${idx}`}
              type="button"
              onClick={() => onSelectChip(item.label)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-100/80 active:scale-95 transition"
            >
              <Ico name={item.icon} className="size-3.5 text-slate-500" />
              <span>{item.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
