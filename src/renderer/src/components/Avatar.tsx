import { useCallback, useEffect, useMemo, useState } from "react";
import { initials } from "../data/mock";

/**
 * Parse a GitHub no-reply email of the form
 *   `12345+username@users.noreply.github.com`  or  `username@users.noreply.github.com`
 * returning the numeric user id (when present) and the username.
 */
function parseGithubNoreply(email: string): { id?: string; username: string } | null {
  const match = /^(?:(\d+)\+)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)@users\.noreply\.github\.com$/i.exec(
    email.trim(),
  );
  if (!match) return null;
  return { id: match[1], username: match[2]! };
}

async function sha256Hex(input: string): Promise<string | null> {
  try {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/**
 * Resolve ordered avatar image candidates for an author email: GitHub photo
 * first, then Gravatar. Returns the current `src` (or null once exhausted /
 * when none apply) and an `onError` to advance to the next candidate.
 */
export function useAvatarSources(email: string, size: number): { src: string | null; onError: () => void } {
  // Synchronous candidates (GitHub) are known immediately; Gravatar needs an
  // async hash, so it is appended once computed.
  const githubCandidates = useMemo(() => {
    const list: string[] = [];
    const gh = parseGithubNoreply(email);
    if (gh) {
      if (gh.id) list.push(`https://avatars.githubusercontent.com/u/${gh.id}?s=${size * 2}&v=4`);
      list.push(`https://github.com/${gh.username}.png?size=${size * 2}`);
    }
    return list;
  }, [email, size]);

  const [candidates, setCandidates] = useState<string[]>(githubCandidates);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIndex(0);
    setCandidates(githubCandidates);
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    void sha256Hex(normalized).then((hash) => {
      if (cancelled || !hash) return;
      // d=404 → Gravatar returns an error (instead of an identicon) when the
      // email has no avatar, so onError can fall through to the initials chip.
      setCandidates([...githubCandidates, `https://www.gravatar.com/avatar/${hash}?s=${size * 2}&d=404`]);
    });
    return () => {
      cancelled = true;
    };
  }, [email, size, githubCandidates]);

  const onError = useCallback(() => setIndex((i) => i + 1), []);
  return { src: candidates[index] ?? null, onError };
}

interface AvatarProps {
  name: string;
  email: string;
  /** Rendered size in px. The remote image is requested at 2x for crispness. */
  size?: number;
  className?: string;
}

/**
 * Author avatar that prefers the photo GitHub uses for the author, then falls
 * back to Gravatar, and finally to the initials chip used elsewhere in the app.
 * Each remote candidate is tried in order; a load error advances to the next.
 */
export function Avatar({ name, email, size = 28, className }: AvatarProps) {
  const { src, onError } = useAvatarSources(email, size);

  if (!src) {
    return (
      <div className={"avatar" + (className ? ` ${className}` : "")}>{initials(name)}</div>
    );
  }

  return (
    <img
      className={"avatar" + (className ? ` ${className}` : "")}
      src={src}
      width={size}
      height={size}
      alt={name}
      referrerPolicy="no-referrer"
      onError={onError}
    />
  );
}
