import React from 'react';

type Tone = 'emerald' | 'amber' | 'red' | 'blue' | 'slate';

const TONE_MAP: Record<Tone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-sky-50 text-sky-700 border-sky-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function resolveStatusTone(value: string): Tone {
  const v = value.toLowerCase();
  if (
    v.includes('active') ||
    v.includes('completed') ||
    v.includes('closed') ||
    v.includes('safe') ||
    v.includes('excellent') ||
    v.includes('good') ||
    v.includes('operational') ||
    v.includes('present') ||
    v.includes('resolved') ||
    v.includes('approved')
  ) {
    if (v.includes('unsafe')) return 'red';
    return 'emerald';
  }
  if (
    v.includes('critical') ||
    v.includes('unsafe') ||
    v.includes('quarantined') ||
    v.includes('breakdown') ||
    v.includes('overdue') ||
    v.includes('out_of_service') ||
    v.includes('absent') ||
    v.includes('rejected')
  ) {
    return 'red';
  }
  if (
    v.includes('progress') ||
    v.includes('pending') ||
    v.includes('under') ||
    v.includes('needs') ||
    v.includes('urgent') ||
    v.includes('high') ||
    v.includes('awaiting') ||
    v.includes('scheduled') ||
    v.includes('investigating') ||
    v.includes('leave')
  ) {
    return 'amber';
  }
  if (v.includes('assigned') || v.includes('submitted') || v.includes('overtime')) {
    return 'blue';
  }
  return 'slate';
}

export const StatusBadge: React.FC<{ label: string; tone?: Tone; className?: string }> = ({
  label,
  tone,
  className = '',
}) => {
  const resolved = tone || resolveStatusTone(label);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${TONE_MAP[resolved]} ${className}`}
    >
      {label}
    </span>
  );
};
