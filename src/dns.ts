import type dns from 'dns';
import { DohResolver } from 'dohjs';

const resolver = new DohResolver('https://cloudflare-dns.com/dns-query');

export const promises: {
  resolveSrv: typeof dns.promises['resolveSrv'];
  resolveTxt: typeof dns.promises['resolveTxt'];
} = {
  async resolveSrv(hostname: string): Promise<dns.SrvRecord[]> {
    const results = await resolver.query(hostname, 'SRV', 'POST', {
      Accept: 'application/dns-message'
    });
    return results.answers.map((answer) => {
      return {
        ...answer.data,
        name: answer.data.target
      };
    });
  },
  async resolveTxt(hostname: string): Promise<string[][]> {
    const results = await resolver.query(hostname, 'TXT', 'POST', {
      Accept: 'application/dns-message'
    });
    return results.answers.map((answer) => answer.data);
  }
};
