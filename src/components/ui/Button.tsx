'use client';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'peach' | 'mint' | 'lavender';
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  peach: 'bg-peach-500 hover:bg-peach-400 text-slate-800',
  mint: 'bg-mint-500 hover:bg-mint-400 text-slate-800',
  lavender: 'bg-lavender-500 hover:bg-lavender-400 text-slate-800',
};

const sizeStyles = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

export default function Button({
  children,
  variant = 'peach',
  onClick,
  className = '',
  disabled = false,
  size = 'md',
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full font-semibold transition-colors duration-200 ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </motion.button>
  );
}
