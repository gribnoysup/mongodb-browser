import process from 'process/browser';
const NS_PER_SEC: number = 1e9;
const _hrtime = (previousTimestamp?: [number, number]): [number, number] => {
  const baseNow = Math.floor((Date.now() - performance.now()) * 1e-3);
  const clocktime = performance.now() * 1e-3;
  let seconds = Math.floor(clocktime) + baseNow;
  let nanoseconds = Math.floor((clocktime % 1) * 1e9);

  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0];
    nanoseconds = nanoseconds - previousTimestamp[1];
    if (nanoseconds < 0) {
      seconds--;
      nanoseconds += 1e9;
    }
  }
  return [seconds, nanoseconds];
};
_hrtime.bigint = (time?: [number, number]): bigint => {
  const diff = _hrtime(time);
  return (diff[0] * NS_PER_SEC + diff[1]) as unknown as bigint;
};
(process as any).hrtime ??= _hrtime;
(process as any).emitWarning ??= console.warn;
(process as any).platform = 'Unknown';
(process as any).arch = 'Unknown';
export default process;
