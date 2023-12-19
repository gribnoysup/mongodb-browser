import net from 'net';
import tls from 'tls';
import dns from 'dns';
import { WebSocketServer } from 'ws';
import { ParseMessage as parseMessage } from 'mongodb-wp-proxy';
import util from 'util';

export function createWebSocketProxy(port = 1337, cert = null) {
  const wsServer = new WebSocketServer({ port }, () => {
    console.log('ws server listening at %s', wsServer.options.port);
  });

  const SOCKET_ERROR_EVENT_LIST = ['error', 'close', 'timeout', 'parseError'];

  wsServer.on('connection', (ws) => {
    let socket;
    console.log('new ws connection (total %s)', wsServer.clients.size);
    ws.on('close', () => {
      console.log('ws closed');
      socket?.removeAllListeners();
      socket?.end();
    });
    ws.on('message', async (data) => {
      if (socket) {
        try {
          const parsed = await parseMessage(data as Buffer);
          console.log(
            'message from client: %s',
            util.inspect(parsed, { breakLength: Infinity, depth: Infinity })
          );
        } finally {
          socket.write(data, 'binary');
        }
      } else {
        // First message before socket is created is with connection info
        const { tls: useTLS, ...connectionOptions } = JSON.parse(
          data.toString()
        );
        const useSecureConnection = useTLS || !!cert;
        console.log(
          'setting up new%s connection to %s:%s',
          useSecureConnection ? ' secure' : '',
          connectionOptions.host,
          connectionOptions.port
        );
        const secureConnectOptions: tls.ConnectionOptions = {
          host: connectionOptions.host,
          port: connectionOptions.port,
          servername: connectionOptions.servername ?? connectionOptions.host,
          // Copied from the driver code
          lookup: (hostname, options, callback) => {
            return dns.lookup(
              hostname,
              { verbatim: false, ...options },
              callback
            );
          },
          ...(cert ? { cert: cert, key: cert } : {})
        };
        socket = useSecureConnection
          ? tls.connect(secureConnectOptions)
          : net.createConnection(connectionOptions);
        const connectEvent = useSecureConnection ? 'secureConnect' : 'connect';
        SOCKET_ERROR_EVENT_LIST.forEach((evt) => {
          socket.on(evt, (err) => {
            console.log('server socket error event (%s)', evt, err);
            ws.send(JSON.stringify({ evt }));
          });
        });
        socket.on(connectEvent, () => {
          console.log(
            'server socket connected at %s:%s',
            connectionOptions.host,
            connectionOptions.port
          );
          ws.send(JSON.stringify({ evt: connectEvent }));
        });
        socket.on('data', async (data) => {
          try {
            const parsed = await parseMessage(data as Buffer);
            console.log(
              'message from server: %s',
              util.inspect(parsed, { breakLength: Infinity, depth: Infinity })
            );
          } finally {
            ws.send(data);
          }
        });
      }
    });
  });
}
