import { ipVersion } from 'is-ip';
import { Duplex } from 'stream';

export const isIP = (input: string) => ipVersion(input) ?? 0;

export { isIPv4, isIPv6 } from 'is-ip';

let warn = false;

const proxy = {
  secure: false,
  host: 'localhost',
  port: 1337
};

export const setProxy = (
  options: { host?: string; port?: number; secure?: boolean } = {}
) => {
  Object.assign(proxy, options);
};

export class Socket extends Duplex {
  private ws: WebSocket;
  constructor() {
    super();
  }
  connect(options: { host: string; port: number; tls?: boolean }) {
    this.ws = new WebSocket(
      `${proxy.secure ? 'wss' : 'ws'}://${proxy.host}:${proxy.port}`
    );
    if (!proxy.secure && options.tls) {
      if (!warn) {
        console.warn('When using tls proxy, use secure web socket connection');
        warn = true;
      }
    }
    this.ws.binaryType = 'arraybuffer';
    this.ws.addEventListener(
      'open',
      () => {
        this.ws.send(JSON.stringify(options));
      },
      { once: true }
    );
    this.ws.addEventListener('close', () => {
      this.emit('close');
    });
    this.ws.addEventListener('error', () => {
      this.emit('error');
    });
    this.ws.addEventListener('message', (ev) => {
      if (ev.data.charAt?.(0) === '{') {
        try {
          const { evt } = JSON.parse(ev.data);
          setTimeout(() => {
            this.emit(evt);
          });
        } catch (err) {
          console.error('error parsing proxy message: %s', ev.data, err);
        }
      } else {
        setTimeout(() => {
          this.emit('data', Buffer.from(ev.data));
        });
      }
    });
    return this;
  }
  _read() {
    // noop
  }
  _write(chunk, _encoding, cb) {
    this.ws.send(chunk);
    setTimeout(cb);
  }
  destroy() {
    this.ws.close();
    return this;
  }
  end(fn) {
    if (this.ws.readyState === this.ws.CLOSED) {
      fn();
      return this;
    }
    this.ws.addEventListener(
      'close',
      () => {
        fn();
      },
      { once: true }
    );
    this.ws.close();
    return this;
  }

  // TODO
  setKeepAlive() {}
  setTimeout() {}
  setNoDelay() {}
}

export const createConnection = (options: { host: string; port: number }) => {
  const socket = new Socket();
  return socket.connect(options);
};
