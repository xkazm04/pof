'use client';

import { motion, useReducedMotion } from 'framer-motion';
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
    transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const reducedContainerVariants: Variants = {
  hidden: {},
  visible: {},
};

const reducedItemVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};

/** Wrapper that staggers children entrance at 40ms intervals. */
export function StaggerContainer({
  children,
  className,
  ...rest
}: HTMLMotionProps<'div'>) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      variants={prefersReduced ? reducedContainerVariants : containerVariants}
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
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      variants={prefersReduced ? reducedItemVariants : itemVariants}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
