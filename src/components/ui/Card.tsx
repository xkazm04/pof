'use client';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-[#111128] border border-[#1e1e3a] rounded-lg ${className}`}>
      {children}
    </div>
  );
}
