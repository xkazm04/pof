import { describe, it, expect } from 'vitest';
import { hungarianSolve } from '../hungarian';

describe('hungarianSolve', () => {
  it('returns empty array for empty matrix', () => {
    expect(hungarianSolve([])).toEqual([]);
  });

  it('solves 1x1 matrix', () => {
    const result = hungarianSolve([[5]]);
    expect(result).toEqual([0]);
  });

  it('finds optimal assignment for identity cost matrix', () => {
    // Identity matrix: optimal is diagonal (cost 0 each)
    const cost = [
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ];
    const result = hungarianSolve(cost);
    // Each row should map to itself (diagonal)
    expect(result).toEqual([0, 1, 2]);
  });

  it('finds optimal assignment for asymmetric costs', () => {
    const cost = [
      [9, 2, 7],
      [6, 4, 3],
      [5, 8, 1],
    ];
    const result = hungarianSolve(cost);
    // Optimal: row0->col1(2), row1->col0(6), row2->col2(1) = 9
    // Or: row0->col1(2), row1->col2(3), row2->col0(5) = 10
    // The algorithm should find minimal total cost
    const totalCost = result.reduce((sum, col, row) => sum + cost[row][col], 0);
    expect(totalCost).toBe(9); // 2 + 6 + 1
  });

  it('handles all-same costs', () => {
    const cost = [
      [5, 5, 5],
      [5, 5, 5],
      [5, 5, 5],
    ];
    const result = hungarianSolve(cost);
    // Any 1-to-1 assignment is optimal
    expect(result).toHaveLength(3);
    const assigned = new Set(result);
    expect(assigned.size).toBe(3); // All unique columns
  });

  it('handles non-square matrix: more rows than columns', () => {
    // 3 rows x 2 cols -- 3 workers, 2 jobs
    const cost = [
      [1, 4],
      [2, 3],
      [5, 6],
    ];
    const result = hungarianSolve(cost);
    expect(result).toHaveLength(3);
    // Best assignment: row0->col0(1), row1->col1(3) = 4, row2 gets dummy
    // Each real column (0, 1) should be assigned to exactly one row
    const realAssignments = result.filter((col) => col < 2);
    const totalCost = result
      .map((col, row) => (col < 2 ? cost[row][col] : 0))
      .reduce((a, b) => a + b, 0);
    expect(realAssignments.length).toBe(2);
    expect(totalCost).toBe(4); // 1 + 3
  });

  it('handles non-square matrix: more columns than rows', () => {
    // 2 rows x 3 cols -- 2 workers, 3 jobs
    const cost = [
      [3, 1, 7],
      [5, 2, 4],
    ];
    const result = hungarianSolve(cost);
    expect(result).toHaveLength(2);
    // Best: row0->col1(1), row1->col2(4) = 5
    // Or: row0->col0(3), row1->col1(2) = 5
    const totalCost = result.reduce((sum, col, row) => sum + cost[row][col], 0);
    expect(totalCost).toBe(5);
  });

  it('assigns unique columns (no duplicates)', () => {
    const cost = [
      [10, 1, 1],
      [1, 10, 1],
      [1, 1, 10],
    ];
    const result = hungarianSolve(cost);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('handles 4x4 matrix correctly', () => {
    const cost = [
      [82, 83, 69, 92],
      [77, 37, 49, 92],
      [11, 69, 5, 86],
      [8, 9, 98, 23],
    ];
    const result = hungarianSolve(cost);
    expect(result).toHaveLength(4);
    const totalCost = result.reduce((sum, col, row) => sum + cost[row][col], 0);
    // Optimal: row0->col2(69), row1->col1(37), row2->col0(11), row3->col3(23) = 140
    expect(totalCost).toBe(140);
  });
});
