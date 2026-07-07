export function buildAuthRedirectUrl(path: `/${string}`, origin: string) {
  return `${origin.replace(/\/+$/, "")}${path}`;
}
