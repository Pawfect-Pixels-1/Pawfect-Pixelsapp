import React, { ReactNode } from 'react';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  activeClass?: string;
  children: ReactNode;
}

export function TabButton({ active, onClick, icon, activeClass = 'bg-[#c6c2e6]', children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-semibold border-2 border-black rounded-lg transition-all flex items-center ${
        active
          ? `${activeClass} text-${activeClass.includes('white') ? 'white' : 'black'} shadow-[4px_4px_0px_0px_#000000]`
          : 'bg-white text-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}