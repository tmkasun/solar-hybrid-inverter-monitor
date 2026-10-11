import type { Status } from "./types";

type StreamOptions = {
  url: string;
  fetchStatus: () => Promise<Status>;
  onStatus: (status: Status) => void;
  onStale: () => void;
  onMessage: (message: { type: string; data: Record<string, any> }) => void;
  createSocket?: (url: string) => WebSocket;
};

/** Reconnect without allowing old HTTP replies to overwrite newer telemetry. */
export function startStatusStream(options: StreamOptions): () => void {
  let stopped = false;
  let socket: WebSocket;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delay = 2000;
  let revision = 0;

  const connect = () => {
    if (stopped) return;
    const current = (options.createSocket || (url => new WebSocket(url)))(options.url);
    socket = current;
    current.onopen = () => {
      if (stopped || socket !== current) return;
      delay = 2000;
      const requestedRevision = revision;
      void options.fetchStatus().then(status => {
        if (!stopped && socket === current && current.readyState === 1 && revision === requestedRevision) {
          options.onStatus(status);
        }
      }).catch(() => {
        if (!stopped && socket === current && revision === requestedRevision) options.onStale();
      });
    };
    current.onmessage = event => {
      if (stopped || socket !== current) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === "telemetry" || message.type === "connection") {
          revision++;
          options.onStatus(message.data);
        } else options.onMessage(message);
      } catch {
        options.onStale();
      }
    };
    current.onerror = () => {
      if (!stopped && socket === current) {
        options.onStale();
        current.close();
      }
    };
    current.onclose = () => {
      if (stopped || socket !== current) return;
      revision++;
      options.onStale();
      timer = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 30000);
    };
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket.close();
  };
}
