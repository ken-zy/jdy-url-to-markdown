import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { resolve } from "path";

const TIMEOUT = 15000;

export function getWsUrl(): string {
  const home = homedir();
  const macBrowsers = [
    "Google/Chrome", "Google/Chrome Beta", "Google/Chrome for Testing",
    "Chromium", "BraveSoftware/Brave-Browser", "Microsoft Edge",
  ];
  const linuxBrowsers = [
    "google-chrome", "google-chrome-beta", "chromium",
    "BraveSoftware/Brave-Browser", "microsoft-edge",
  ];

  const candidates: (string | undefined)[] = [
    process.env.CDP_PORT_FILE,
    ...macBrowsers.flatMap(b => [
      resolve(home, "Library/Application Support", b, "DevToolsActivePort"),
    ]),
    ...linuxBrowsers.flatMap(b => [
      resolve(home, ".config", b, "DevToolsActivePort"),
    ]),
  ];

  const portFile = candidates.filter(Boolean).find(p => existsSync(p!));
  if (!portFile) {
    throw new Error(
      "No DevToolsActivePort found. Start Chrome with remote debugging:\n" +
      "  chrome --remote-debugging-port=0\n" +
      "Or enable at chrome://flags/#allow-remote-debugging"
    );
  }

  const lines = readFileSync(portFile, "utf-8").trim().split("\n");
  if (lines.length < 2 || !lines[0] || !lines[1]) {
    throw new Error(`Invalid DevToolsActivePort: ${portFile}`);
  }

  const host = process.env.CDP_HOST || "127.0.0.1";
  return `ws://${host}:${lines[0]}${lines[1]}`;
}

export class CDPConnection {
  private ws!: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private eventHandlers = new Map<string, ((params: any) => void)[]>();

  async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(new Error(`CDP WebSocket error: ${e}`));
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(String(event.data));
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if (msg.error) p.reject(new Error(msg.error.message));
            else p.resolve(msg.result);
          }
        } else if (msg.method) {
          const handlers = this.eventHandlers.get(msg.method) || [];
          for (const h of handlers) h(msg.params);
        }
      };
      this.ws.onclose = () => {
        for (const p of this.pending.values()) {
          p.reject(new Error("CDP connection closed"));
        }
        this.pending.clear();
      };
    });
  }

  async send(method: string, params: any = {}, sessionId?: string): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, TIMEOUT);

      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });

      const msg: any = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      this.ws.send(JSON.stringify(msg));
    });
  }

  on(event: string, handler: (params: any) => void): void {
    const list = this.eventHandlers.get(event) || [];
    list.push(handler);
    this.eventHandlers.set(event, list);
  }

  off(event: string, handler: (params: any) => void): void {
    const list = this.eventHandlers.get(event);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  close(): void {
    this.ws.close();
  }
}
