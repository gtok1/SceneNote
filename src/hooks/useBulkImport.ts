import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query";
import { runNetflixBulkImport } from "@/services/bulkImport";
import { useAuthStore } from "@/stores/authStore";
import type { NetflixBulkImportRow } from "@/types/bulkImport";

export function useNetflixBulkImport() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: ({ rows, commit }: { rows: NetflixBulkImportRow[]; commit: boolean }) =>
      runNetflixBulkImport({ rows, commit }),
    onSuccess: (report) => {
      if (user && report.mode === "commit") {
        queryClient.invalidateQueries({ queryKey: queryKeys.library.all(user.id) });
      }
    }
  });
}
