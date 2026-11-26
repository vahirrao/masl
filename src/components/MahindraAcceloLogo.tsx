import React from 'react';

interface MahindraAcceloLogoProps {
  variant?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}

export const MahindraAcceloLogo: React.FC<MahindraAcceloLogoProps> = ({
  variant = 'dark',
  compact = false,
  className = '',
}) => {
  const wordmarkColor = variant === 'light' ? 'text-white' : 'text-slate-900';
  const accentColor = variant === 'light' ? 'text-red-400' : 'text-[#D71920]';
  const subColor = variant === 'light' ? 'text-slate-300' : 'text-slate-500';
  const trackerColor = variant === 'light' ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Industrial Red-and-White MASL Steel Beam & M Mark */}
      <svg
        width={compact ? 32 : 38}
        height={compact ? 32 : 38}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Mahindra Auto Steel Private Limited (MASL) Mark"
        className="shrink-0"
      >
        <rect width="40" height="40" rx="8" fill="#D71920" />
        <rect x="2" y="2" width="36" height="36" rx="6.5" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1" />
        <path
          d="M7.5 27.5V12.5H12.2L20 21.8L27.8 12.5H32.5V27.5H28.3V18.4L21.3 26.8H18.7L11.7 18.4V27.5H7.5Z"
          fill="#FFFFFF"
        />
        <path
          d="M7.5 31.2H32.5"
          stroke="#FFFFFF"
          strokeOpacity="0.9"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {!compact && (
        <div className="flex flex-col leading-tight min-w-0">
          <div className="flex items-baseline gap-1 whitespace-nowrap">
            <span className={`font-display text-sm font-extrabold tracking-tight ${wordmarkColor}`}>
              Mahindra
            </span>
            <span className={`font-display text-sm font-extrabold tracking-tight ${accentColor}`}>
              Auto Steel
            </span>
          </div>
          <span className={`text-[10.5px] font-semibold tracking-wide whitespace-nowrap ${subColor}`}>
            Private Limited (MASL)
          </span>
          <span className={`text-[9.5px] font-medium tracking-wider uppercase mt-0.5 whitespace-nowrap ${trackerColor}`}>
            Trolley Lifecycle Tracker
          </span>
        </div>
      )}
    </div>
  );
};
