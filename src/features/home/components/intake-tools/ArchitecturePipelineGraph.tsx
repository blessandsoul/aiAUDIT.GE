'use client';

import { Ico } from '@/components/common/Ico';

export function ArchitecturePipelineGraph() {
  const steps = [
    {
      id: '1',
      title: 'ვიზიტორი არხში',
      sub: 'Instagram, TikTok, Facebook, საიტი',
      icon: 'solar:global-bold-duotone',
      color: '#3b82f6',
    },
    {
      id: '2',
      title: 'Nemo AI კვალიფიკაცია',
      sub: '24/7 პასუხი, ფასები, კონსულტაცია',
      icon: 'solar:magic-stick-3-bold-duotone',
      color: '#10b981',
    },
    {
      id: '3',
      title: 'გაყიდვა & CRM',
      sub: 'ჯავშანი, შეკვეთა, გადახდა',
      icon: 'solar:check-circle-bold-duotone',
      color: '#7c3aed',
    },
    {
      id: '4',
      title: 'aiADS რეტარგეტინგი',
      sub: 'მომგებიანი აუდიტორიის ზრდა',
      icon: 'solar:target-bold-duotone',
      color: '#ec4899',
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-md bg-purple-50 text-purple-600">
            <Ico name="solar:diagram-up-bold-duotone" className="size-4" />
          </div>
          <span className="text-xs font-bold text-slate-900">
            ავტონომიური ბიზნეს-მილსადენის რუკა (Architecture Pipeline)
          </span>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          სრული ციკლი
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 relative">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 relative flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div
                  className="grid size-7 place-items-center rounded-lg"
                  style={{ backgroundColor: `${step.color}15`, color: step.color }}
                >
                  <Ico name={step.icon} className="size-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400">0{step.id}</span>
              </div>
              <h5 className="text-xs font-bold text-slate-900 leading-snug">
                {step.title}
              </h5>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                {step.sub}
              </p>
            </div>
            {idx < steps.length - 1 && (
              <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-300">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
