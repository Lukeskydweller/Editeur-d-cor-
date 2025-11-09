/**
 * Type-safe wrapper for Object.entries that preserves key-value relationship.
 *
 * TypeScript's native Object.entries() widens keys to string and values to unknown,
 * losing the typed relationship between keys and values. This helper preserves it.
 *
 * @example
 * const obj = { a: 1, b: 'hello' } as const;
 * typedEntries(obj).forEach(([key, value]) => {
 *   // key is typed as "a" | "b"
 *   // value is typed as 1 | "hello" (not unknown)
 * });
 *
 * @see https://stackoverflow.com/questions/60141960/typescript-key-value-relation-preserving-object-entries-type
 */
export function typedEntries<T extends object>(obj: T): Array<[keyof T, T[keyof T]]> {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>;
}
