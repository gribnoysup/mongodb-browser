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
  const [connectionString, setConnectionString] = useState('');
  const [pemKey, setPemKey] = useState('');
  const client = useRef<MongoClient>();

  const onConnectionStringChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      setConnectionString(evt.currentTarget.value);
    },
    []
  );

  const onFileSelect = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = evt.currentTarget;
      if (files && files[0]) {
        files[0].text().then((text) => {
          setPemKey(text);
        });
      }
    },
    []
  );

  const onConnect = useCallback(async () => {
    try {
      setStatus('connecting');
      client.current = globalThis.client = new MongoClient(
        connectionString,
        pemKey
          ? {
              cert: pemKey,
              key: pemKey
            }
          : undefined
      );
      await client.current.connect();
      setStatus('connected');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }, [connectionString, pemKey]);

  return (
    <div>
      <div>
        <label>
          <span>Connection string</span>
          <input
            type="text"
            disabled={status !== 'idle'}
            value={connectionString}
            onChange={onConnectionStringChange}
          />
        </label>
        <label>
          <span>Certificate (.pem file)</span>
          <input
            type="file"
            disabled={status !== 'idle'}
            onChange={onFileSelect}
          />
        </label>
        <button disabled={status !== 'idle'} onClick={onConnect}>
          Connect
        </button>
        <span>{status}</span>
      </div>
    </div>
  );
};
