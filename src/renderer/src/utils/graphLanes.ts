export interface LaneCommit {
  id: string;
  parents: string[];
  lane: number;
  parentsLanes: number[];
}

interface InputCommit {
  id: string;
  parents: string[];
}

function firstFree(lanes: Array<string | null>): number {
  for (let i = 0; i < lanes.length; i++) {
    if (lanes[i] == null) return i;
  }
  lanes.push(null);
  return lanes.length - 1;
}

export function assignLanes<T extends InputCommit>(commits: T[]): Array<T & { lane: number; parentsLanes: number[] }> {
  const active: Array<string | null> = [];
  const out: Array<T & { lane: number; parentsLanes: number[] }> = [];

  for (const c of commits) {
    const claimed: number[] = [];
    for (let i = 0; i < active.length; i++) {
      if (active[i] === c.id) claimed.push(i);
    }

    let lane: number;
    if (claimed.length > 0) {
      lane = claimed[0];
      for (let k = 1; k < claimed.length; k++) active[claimed[k]] = null;
      active[lane] = null;
    } else {
      lane = firstFree(active);
    }

    if (c.parents.length > 0) {
      active[lane] = c.parents[0];
    }

    const parentsLanes: number[] = [];
    parentsLanes.push(c.parents.length > 0 ? lane : lane);

    for (let p = 1; p < c.parents.length; p++) {
      const existing = active.indexOf(c.parents[p]);
      const target = existing >= 0 ? existing : firstFree(active);
      if (existing < 0) active[target] = c.parents[p];
      parentsLanes.push(target);
    }

    out.push({ ...c, lane, parentsLanes });
  }

  return out;
}
