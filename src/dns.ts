import { query, wellknown, lookupTxt } from 'dns-query';
import { promisify } from 'util';

export function resolveSrv(hostname, cb) {
  query(
    { question: { type: 'SRV', name: hostname } },
    { endpoints: wellknown.endpoints('doh') }
  ).then(({ answers }) => {
    cb(
      null,
      answers?.flatMap((answer) => {
        if (answer.type === 'SRV') {
          return {
            ...answer.data,
            name: answer.data.target
          };
        }
        return [];
      }) ?? []
    );
  }, cb);
}
export function resolveTxt(hostname, cb) {
  lookupTxt(hostname, { endpoints: wellknown.endpoints('doh') }).then(
    ({ entries }) => {
      cb(
        null,
        entries.map((entry) => {
          return [entry.data];
        })
      );
    },
    cb
  );
}

export const promises = {
  resolveSrv: promisify(resolveSrv),
  resolveTxt: promisify(resolveTxt)
};

export default {
  resolveSrv,
  resolveTxt,
  promises
};
