/** PostgREST may return error:null for an UPDATE that matched no visible row. */
export function assertLibraryWriteApplied(
  result: { data: readonly unknown[] | null; error: { message: string } | null },
  message: string
): void {
  if (result.error) throw new Error(result.error.message);
  if (!result.data?.length) throw new Error(message);
}
