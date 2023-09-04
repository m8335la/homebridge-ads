import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { AdsPlatform } from './adsPlatform';
import * as Ads from 'node-ads';


export class AdsDevice {

  constructor(
    protected readonly platform: AdsPlatform,
    protected readonly accessory: PlatformAccessory,
    public readonly symname: string,
  ) {

  }
}
