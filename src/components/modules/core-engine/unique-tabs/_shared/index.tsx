'use client';

/**
 * Barrel for the shared primitives used across `core-engine/unique-tabs/`.
 * The implementation is split into cohesive sibling files (each ≤300 LOC);
 * this module re-exports every symbol so importers keep resolving
 * `.../unique-tabs/_shared` unchanged.
 */

export * from './constants';
export * from './headers';
export * from './primitives';
export * from './features';
export * from './charts';
export * from './dataviz';
export * from './tabs';
export * from './navigation';
