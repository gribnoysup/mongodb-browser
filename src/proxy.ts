import net from 'net';
import tls from 'tls';
import { WebSocketServer } from 'ws';
import { ParseMessage as parseMessage } from 'mongodb-wp-proxy';
import util from 'util';

export function createWebSocketProxy(port = 1337) {
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
        console.log(
          'setting up new%s connection to %s:%s',
          useTLS ? ' secure' : '',
          connectionOptions.host,
          connectionOptions.port
        );
        socket = useTLS
          ? tls.connect(connectionOptions)
          : net.createConnection(connectionOptions);
        const connectEvent = useTLS ? 'secureConnect' : 'connect';
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
