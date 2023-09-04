import { EventEmitter } from 'node:events';

declare type AdsArrayHandle = {
  adsState: object;
  symname: string;
  value: unknown[];
};


type Callback = (handle: AdsArrayHandle) => void;
type ReadCallback = (err: object, handle: AdsArrayHandle) => void;
type WriteCallback = (err: object) => void;

declare class AdsClient {
  constructor(greeting: string);
  on(eventName: string, listener: Callback): EventEmitter;
  notify(handle: object): void;
  read(handle: object, cb: ReadCallback): void;
  readState(cb: ReadCallback): void;
  write(handle: object, cb: WriteCallback): void;
}
