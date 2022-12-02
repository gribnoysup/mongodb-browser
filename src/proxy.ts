import { VerifyClientCallbackSync, WebSocketServer } from 'ws';
import util from 'util';
import { MongoClient, MongoClientOptions } from 'mongodb';
import * as bson from 'bson';

const OP_MSG = 2013;

// from https://github.com/mongodb/node-mongodb-native/blob/what-if-ws/test/integration/node-specific/web_sockets.test.ts#L160
function serializeResponse(requestId: number, response: any) {
  const responseBytes = bson.serialize(response);
  const payloadTypeBuffer = Buffer.alloc(1, 0);
  const headers = Buffer.alloc(20);
  headers.writeInt32LE(0, 4);
  headers.writeInt32LE(requestId, 8);
  headers.writeInt32LE(OP_MSG, 12);
  headers.writeInt32LE(0, 16);
  const bufferResponse = Buffer.concat([
    headers,
    payloadTypeBuffer,
    responseBytes
  ]);
  bufferResponse.writeInt32LE(bufferResponse.byteLength, 0);
  return bufferResponse;
}

function parseMessage(message: Buffer) {
  const messageHeader = {
    length: message.readInt32LE(0),
    requestId: message.readInt32LE(4),
    responseTo: message.readInt32LE(8),
    opCode: message.readInt32LE(12),
    flags: message.readInt32LE(16)
  };

  if (messageHeader.opCode !== OP_MSG) {
    const nsNullTerm = message.indexOf(0x00, 20);
    const ns = message.toString('utf8', 20, nsNullTerm);
    const nsLen = nsNullTerm - 20 + 1;
    const numberToSkip = message.readInt32LE(20 + nsLen);
    const numberToReturn = message.readInt32LE(20 + nsLen + 4);
    const docStart = 20 + nsLen + 4 + 4;
    const docLen = message.readInt32LE(docStart);
    const doc = bson.deserialize(message.subarray(docStart, docStart + docLen));
    return {
      ...messageHeader,
      ns,
      numberToSkip,
      numberToReturn,
      doc
    };
  } else {
    const payloadType = message.readUint8(20);
    const docStart = 20 + 1;
    const docLen = message.readInt32LE(docStart);
    const doc = bson.deserialize(message.subarray(docStart, docStart + docLen));
    return {
      ...messageHeader,
      payloadType,
      doc
    };
  }
}

function isFirstHello(query: any) {
  return (query.hello || query.helloOk) && query.client;
}

export function createWebSocketProxy({
  port = 1337,
  connectionUrl = 'mongodb://localhost:27020',
  connectionOptions = { maxPoolSize: 1 },
  verifyClient
}: {
  port?: number;
  connectionUrl?: string;
  connectionOptions?: MongoClientOptions;
  verifyClient?: VerifyClientCallbackSync;
} = {}) {
  const wsServer = new WebSocketServer({ port, verifyClient }, () => {
    console.log('ws server listening at %s', wsServer.options.port);
  });

  wsServer.on('connection', (ws) => {
    let client: MongoClient | null = null;

    console.log('new ws connection (total %s)', wsServer.clients.size);

    ws.on('close', () => {
      console.log('ws closed');
      void client?.removeAllListeners().close();
    });

    ws.on('message', async (data) => {
      if (client) {
        try {
          const message = parseMessage(data as Buffer);
          console.log(
            'message from client: %s',
            util.inspect(message, { breakLength: Infinity, depth: Infinity })
          );
          // from https://github.com/mongodb/node-mongodb-native/blob/what-if-ws/test/integration/node-specific/web_sockets.test.ts#L160
          try {
            let result = {};
            // https://github.com/mongodb/specifications/blob/master/source/auth/auth.rst#authentication-handshake
            if (isFirstHello(message.doc)) {
              // probably better to cherry-pick stuff here
              result = await client.db('admin').command({ hello: true });
              // required by loadBalanced mode
              (result as any).serviceId = new bson.ObjectId();
            } else {
              result = await client
                .db(message.doc.$db ?? 'admin')
                .command(message.doc);
            }

            console.log(
              'response from server: %s',
              util.inspect(result, { breakLength: Infinity, depth: Infinity })
            );

            ws.send(serializeResponse(message.requestId, result));
          } catch (error) {
            console.error(error);
            ws.send(
              serializeResponse(message.requestId, {
                ok: 0,
                errmsg: error.message,
                code: error.code
              })
            );
          }
        } catch (error) {
          console.log(error);
          ws.send(JSON.stringify({ evt: 'error' }));
        }
      } else {
        // First message before client is created is connection. A this point we
        // autoconnect the driver with our server URL
        client = new MongoClient(connectionUrl, connectionOptions);

        client.connect().then(
          () => {
            console.log('connected to %s', connectionUrl);
            ws.send(JSON.stringify({ evt: 'connect' }));
          },
          (error) => {
            console.log(error);
            ws.send(JSON.stringify({ evt: 'error' }));
          }
        );
      }
    });
  });
}
