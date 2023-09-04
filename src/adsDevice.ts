import { PlatformAccessory } from 'homebridge';
import { AdsPlatform } from './adsPlatform';


export class AdsDevice {

  constructor(
    protected readonly platform: AdsPlatform,
    protected readonly accessory: PlatformAccessory,
    public readonly symname: string,
  ) {

  }
}
