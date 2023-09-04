import { EventEmitter } from 'node:events';


declare class AdsClient {
  constructor(greeting: string);
  on(eventName: string, listener: Function): EventEmitter;
  notify(handle: object): void;
  read(handle: object, cb: Function): void;
  readState(cb: Function): void;
  write(handle: object, cb: Function): void;
};

declare type AdsArrayHandle = {
  symname: string;
  value: unknown[];
};
