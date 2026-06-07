export type AuthLinkSession =
  | {
      kind: "tokens";
      access_token: string;
      refresh_token: string;
      shouldSetPassword: boolean;
    }
  | {
      kind: "code";
      code: string;
      shouldSetPassword: boolean;
    };

export function getAuthLinkSession(url: string): AuthLinkSession | null {
  const params = getUrlParams(url);
  const type = params.get("type") ?? params.get("redirect_type");
  const shouldSetPassword = type === "recovery" || type === "invite" || url.includes("/reset-password");

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (accessToken && refreshToken) {
    return {
      kind: "tokens",
      access_token: accessToken,
      refresh_token: refreshToken,
      shouldSetPassword
    };
  }

  const code = params.get("code");

  if (code) {
    return {
      kind: "code",
      code,
      shouldSetPassword
    };
  }

  return null;
}

function getUrlParams(url: string) {
  const params = new URLSearchParams();
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");

  if (queryIndex >= 0) {
    const queryEnd = hashIndex > queryIndex ? hashIndex : undefined;
    appendParams(params, url.slice(queryIndex + 1, queryEnd));
  }

  if (hashIndex >= 0) {
    appendParams(params, url.slice(hashIndex + 1));
  }

  return params;
}

function appendParams(target: URLSearchParams, rawParams: string) {
  if (!rawParams) return;

  const params = new URLSearchParams(rawParams);
  params.forEach((value, key) => {
    target.set(key, value);
  });
}
