import type { ParseResult } from "../types";

interface AdapterContext {
  timeout: number;
  ensureDaemon: () => Promise<import("net").Socket>;
  sendDaemonRequest: (sock: import("net").Socket, method: string, params?: any) => Promise<any>;
}

type ZsxqUrl =
  | { type: "topic"; groupId: string; topicId: string }
  | { type: "article"; slug: string }
  | { type: "shortlink"; code: string };

export function parseZsxqUrl(url: string): ZsxqUrl | null {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "wx.zsxq.com") {
    const match = parsed.pathname.match(/^\/group\/(\d+)\/topic\/(\d+)/);
    if (match) return { type: "topic", groupId: match[1], topicId: match[2] };
    return null;
  }

  if (host === "articles.zsxq.com") {
    const match = parsed.pathname.match(/^\/id_([^.]+)\.html/);
    if (match) return { type: "article", slug: match[1] };
    return null;
  }

  if (host === "t.zsxq.com") {
    const code = parsed.pathname.slice(1);
    if (code) return { type: "shortlink", code };
    return null;
  }

  return null;
}

export function cleanZsxqMarkup(text: string): string {
  return text
    .replace(/<e type="text_bold" title="([^"]*)"[^/]*\/>/g, (_, t) => `**${decodeURIComponent(t)}**`)
    .replace(/<e type="hashtag"[^/]*title="([^"]*)"[^/]*\/>/g, (_, t) => `#${decodeURIComponent(t)}`)
    .replace(/<e type="mention"[^/]*name="([^"]*)"[^/]*\/>/g, (_, n) => `@${decodeURIComponent(n)}`)
    .replace(/<e type="web"[^/]*href="([^"]*)"[^/]*title="([^"]*)"[^/]*\/>/g, (_, h, t) => `[${decodeURIComponent(t)}](${decodeURIComponent(h)})`)
    .replace(/<e type="web"[^/]*href="([^"]*)"[^/]*\/>/g, (_, h) => decodeURIComponent(h))
    .replace(/<e [^/]*\/>/g, "");
}

// extract() will be added in Task 2
export async function extract(_url: string, _ctx: AdapterContext): Promise<ParseResult> {
  throw new Error("Not implemented yet");
}
