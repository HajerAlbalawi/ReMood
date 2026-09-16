import { useMemo } from 'react';
import {
  useGetGoodreadsShelf,
  getGetGoodreadsShelfQueryKey,
  GoodreadsShelf,
  GoodreadsGenrePreference,
} from '@workspace/api-client-react';

export interface CombinedGoodreadsProfile {
  excludeBooks: string[];
  preferredGenres: string[];
  shelves: {
    read?: GoodreadsShelf;
    currentlyReading?: GoodreadsShelf;
    toRead?: GoodreadsShelf;
  };
  isLoading: boolean;
  error: Error | null;
}

export function useGoodreadsProfile(userId: string | null): CombinedGoodreadsProfile {
  const readParams = { userId: userId ?? '', shelf: 'read' as const };
  const currentParams = { userId: userId ?? '', shelf: 'currently-reading' as const };
  const toReadParams = { userId: userId ?? '', shelf: 'to-read' as const };
  const readQuery = useGetGoodreadsShelf(
    readParams,
    { query: { enabled: !!userId, staleTime: 5 * 60 * 1000, retry: 1, queryKey: getGetGoodreadsShelfQueryKey(readParams) } },
  );
  const currentQuery = useGetGoodreadsShelf(
    currentParams,
    { query: { enabled: !!userId, staleTime: 5 * 60 * 1000, retry: 1, queryKey: getGetGoodreadsShelfQueryKey(currentParams) } },
  );
  const toReadQuery = useGetGoodreadsShelf(
    toReadParams,
    { query: { enabled: !!userId, staleTime: 5 * 60 * 1000, retry: 1, queryKey: getGetGoodreadsShelfQueryKey(toReadParams) } },
  );

  return useMemo(() => {
    if (!userId) {
      return {
        excludeBooks: [],
        preferredGenres: [],
        shelves: {},
        isLoading: false,
        error: null,
      };
    }

    const excludeBooks: string[] = [
      ...(readQuery.data?.books.map((book) => book.title) ?? []),
      ...(currentQuery.data?.books.map((book) => book.title) ?? []),
    ];
    const genreMap = new Map<string, number>();

    const addGenres = (
      genres: GoodreadsGenrePreference[] | undefined,
      weight: number,
    ) => {
      for (const preference of genres ?? []) {
        genreMap.set(
          preference.genre,
          (genreMap.get(preference.genre) ?? 0) + preference.score * weight,
        );
      }
    };

    addGenres(readQuery.data?.genreProfile, 1);
    addGenres(currentQuery.data?.genreProfile, 0.8);
    addGenres(toReadQuery.data?.genreProfile, 0.45);

    const preferredGenres = [...genreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([genre]) => genre);

    const queryError = readQuery.error ?? currentQuery.error ?? toReadQuery.error;

    return {
      excludeBooks,
      preferredGenres,
      shelves: {
        read: readQuery.data,
        currentlyReading: currentQuery.data,
        toRead: toReadQuery.data,
      },
      isLoading: readQuery.isLoading || currentQuery.isLoading || toReadQuery.isLoading,
      error: queryError instanceof Error ? queryError : queryError ? new Error('تعذر تحميل مكتبة Goodreads') : null,
    };
  }, [
    userId,
    readQuery.data,
    readQuery.error,
    readQuery.isLoading,
    currentQuery.data,
    currentQuery.error,
    currentQuery.isLoading,
    toReadQuery.data,
    toReadQuery.error,
    toReadQuery.isLoading,
  ]);
}
