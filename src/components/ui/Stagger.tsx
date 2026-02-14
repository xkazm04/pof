'use client';

import { motion } from 'framer-motion';
import type { HTMLMotionProps, Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: 'easeOut' as const },
  },
};

/** Wrapper that staggers children entrance at 40ms intervals. */
export function StaggerContainer({
  children,
  className,
  ...rest
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Individual item inside a StaggerContainer. */
export function StaggerItem({
  children,
  className,
  ...rest
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={itemVariants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}
