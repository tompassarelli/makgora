export interface Folded<Job> { commit: string; readonly jobs: Job[] }

export const fanGroups = <Job>(groups: readonly Folded<Job>[], ways: number): Folded<Job>[] => {
  const fanned = groups.map(group => ({ commit: group.commit, jobs: [...group.jobs] }));
  while (fanned.length < ways) {
    const widest = fanned.reduce((best, group, index) => (group.jobs.length > (fanned[best]?.jobs.length ?? 0) ? index : best), 0);
    const group = fanned[widest];
    if (group === undefined || group.jobs.length < 2) break;
    const parts = Math.min(ways - fanned.length + 1, group.jobs.length);
    const chunks = Array.from({ length: parts }, (_, part) => group.jobs.filter((_job, index) => index % parts === part));
    fanned.splice(widest, 1, ...chunks.map(jobs => ({ commit: group.commit, jobs })));
  }
  return fanned;
};
