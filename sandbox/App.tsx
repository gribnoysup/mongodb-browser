import React, { useCallback, useRef, useState } from 'react';
import { MongoClient } from 'mongodb';
import vm from 'vm';
import util from 'util';
import * as bson from 'bson';

globalThis.vm = vm;
globalThis.util = util;
globalThis.bson = bson;

const css = String.raw;

const styleTag = document.createElement('style');

styleTag.innerText = css``;

document.body.appendChild(styleTag);

export const App: React.FunctionComponent = () => {
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error'
  >('idle');
  const client = useRef<MongoClient>();

  const onConnect = useCallback(async () => {
    try {
      setStatus('connecting');
      client.current = globalThis.client = new MongoClient(
        // load balanced is only available in uri
        `mongodb://autoconnect?loadBalanced=true`
      );
      await client.current.connect();
      await client.current.db('admin').command({ hello: true });
      setStatus('connected');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }, []);

  return (
    <div>
      <div>
        <button disabled={status !== 'idle'} onClick={onConnect}>
          Connect
        </button>
        <span>{status}</span>
      </div>
    </div>
  );
};
