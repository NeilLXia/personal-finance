/**
 * Helpers for keeping a react-query list cache (`setQueryData`) in sync after a
 * create/update/delete mutation. The dashboard modals all need the same
 * "upsert by id, keep sorted" behaviour; before this they each re-implemented
 * it slightly differently.
 */

type WithId = { id: number };

export const upsertById = <T extends WithId>(
  list: readonly T[] = [],
  item: T,
  compare: (a: T, b: T) => number,
): T[] => {
  const next = list.some((entry) => entry.id === item.id)
    ? list.map((entry) => (entry.id === item.id ? item : entry))
    : [...list, item];

  return [...next].sort(compare);
};

export const upsertManyById = <T extends WithId>(
  list: readonly T[] = [],
  items: readonly T[],
  compare: (a: T, b: T) => number,
): T[] => {
  const byId = new Map<number, T>();

  // `items` last so a freshly returned row wins over a stale cached copy.
  [...list, ...items].forEach((entry) => byId.set(entry.id, entry));

  return [...byId.values()].sort(compare);
};

export const removeById = <T extends WithId>(
  list: readonly T[] = [],
  id: number,
): T[] => list.filter((entry) => entry.id !== id);
