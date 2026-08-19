'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Layers } from 'lucide-react';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { motionSafe } from '@/lib/motion';
import type { SubGenreId } from '@/types/telemetry';
import { GenreTemplateGallery } from '@/components/modules/core-engine/GenreTemplateGallery';
import { SUB_GENRE_STYLES } from './constants';
import { formatSubGenreName } from './helpers';

export function AcceptedGenres({ genres }: { genres: SubGenreId[] }) {
  const prefersReduced = useReducedMotion();
  const [openGenre, setOpenGenre] = useState<SubGenreId | null>(null);
  const openStyle = openGenre
    ? SUB_GENRE_STYLES[openGenre] ?? { color: 'var(--text-muted)', icon: Layers }
    : null;
  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionSafe({ duration: 0.22, delay: 0.15 }, prefersReduced)}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
        <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
          Active Sub-Genres
        </span>
        <span className="text-2xs text-text-muted">tap for genome templates</span>
      </div>
      {/* Sub-genre acceptances are stored WITHOUT a project (unlike scans, which are
          project-scoped), and accepting one changes module checklists everywhere. Say
          so — a global effect sitting inside a project-scoped panel must not be left
          to be inferred. */}
      <p className="text-2xs text-text-muted mb-2.5" data-testid="accepted-genres-scope">
        Applies to every project in this install — sub-genre acceptances are not project-scoped.
      </p>
      <div className="flex flex-wrap gap-2">
        {genres.map(g => {
          const style = SUB_GENRE_STYLES[g] ?? { color: 'var(--text-muted)', icon: Layers };
          const Icon = style.icon;
          const isOpen = openGenre === g;
          return (
            <button
              key={g}
              onClick={() => setOpenGenre(prev => prev === g ? null : g)}
              aria-pressed={isOpen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
              style={{
                backgroundColor: `${style.color}${isOpen ? '20' : '10'}`,
                color: style.color,
                border: `1px solid ${style.color}${isOpen ? '40' : '25'}`,
              }}
            >
              <Icon className="w-3 h-3" />
              {formatSubGenreName(g)}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {openGenre && openStyle && (
          <motion.div
            key={openGenre}
            initial={prefersReduced ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={motionSafe({ duration: 0.22 }, prefersReduced)}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <GenreTemplateGallery subGenre={openGenre} accentColor={openStyle.color} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
