export interface Folded<Job> { commit: string; readonly jobs: Job[] }

export const fanGroups = <Job>(groups: readonly Folded<Job>[], ways: number): Folded<Job>[] => {
  const fanned = groups.map(group => ({ commit: group.commit, jobs: [...group.jobs] }));
  while (fanned.length < ways) {
    const widest = fanned.reduce((best, group, index) => (group.jobs.length > (fanned[best]?.jobs.length ?? 0) ? index : best), 0);
    const group = fanned[widest];
    if (group === undefined || group.jobs.length < 2) break;
    const half = Math.ceil(group.jobs.length / 2);
    fanned.splice(widest, 1, { commit: group.commit, jobs: group.jobs.slice(0, half) }, { commit: group.commit, jobs: group.jobs.slice(half) });
  }
  return fanned;
};
