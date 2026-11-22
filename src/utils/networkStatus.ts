export interface NetworkStatusLike {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}

export function isNetworkOffline(state: NetworkStatusLike | null | undefined): boolean {
  return state?.isConnected === false || state?.isInternetReachable === false;
}
