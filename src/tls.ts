import { Socket } from 'net';

export const connect = (options) => {
  const tlsSocket = new Socket();
  return tlsSocket.connect({ ...options, tls: true });
};
