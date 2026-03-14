/**
 * Hungarian (Kuhn-Munkres) algorithm for optimal assignment.
 *
 * Given an n x m cost matrix, finds a 1-to-1 assignment of rows to columns
 * that minimizes total cost. Handles non-square matrices by padding internally.
 *
 * Complexity: O(n^3) where n = max(rows, cols).
 *
 * @param costMatrix - 2D array where costMatrix[i][j] is the cost of
 *   assigning row i to column j. Lower cost = better.
 * @returns Array where result[row] = assigned column index.
 *   For padded (dummy) rows, the assigned column may be a dummy column index.
 */
export function hungarianSolve(costMatrix: number[][]): number[] {
  const rows = costMatrix.length;
  if (rows === 0) return [];
  const cols = costMatrix[0]?.length ?? 0;
  if (cols === 0) return new Array<number>(rows).fill(0);

  // Pad to square matrix with large cost for dummy entries
  const n = Math.max(rows, cols);
  const BIG = 1e9;
  const padded: number[][] = [];

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i < rows && j < cols) {
        row.push(costMatrix[i][j]);
      } else {
        row.push(BIG);
      }
    }
    padded.push(row);
  }

  // u[i], v[j] = potentials for workers/jobs (1-indexed, 0 is dummy)
  const u = new Float64Array(n + 1);
  const v = new Float64Array(n + 1);
  // p[j] = worker assigned to job j
  const p = new Int32Array(n + 1);
  // way[j] = previous job in the augmenting path to j
  const way = new Int32Array(n + 1);

  for (let i = 1; i <= n; i++) {
    // Start augmenting path from worker i
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(n + 1).fill(Infinity);
    const used = new Uint8Array(n + 1);

    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = padded[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }

      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    // Trace augmenting path back
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  // Convert: result[row] = column (only for real rows)
  const result = new Array<number>(rows);
  for (let j = 1; j <= n; j++) {
    if (p[j] !== 0 && p[j] - 1 < rows) {
      result[p[j] - 1] = j - 1;
    }
  }
  return result;
}
