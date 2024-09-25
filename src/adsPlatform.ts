import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { AdsDimmableLightbulb } from './adsDimmableLightbulb';
import { AdsLightbulbDevice } from './adsLightbulbDevice';
import { AdsVenetianBlindEx1Switch } from './adsVenetianBlindEx1Switch';
import { AdsDevice } from './adsDevice';
import * as Ads from 'node-ads';
import { AdsClient } from './decs';



/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class AdsPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly adsDevices: AdsDevice[] = [];
  public client!: AdsClient;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  public write(handle: object, callback: (err: object) => void) {
    // lock
    this.client.write(handle, (err: object) => {
      // unlock
      callback(err);
    });
  }

  connectToAds() {
    this.log.info('connecting to ADS');
    this.client = Ads.connect({
      host: this.config.host,
      amsNetIdTarget: this.config.amsNetIdTarget,
      amsNetIdSource: this.config.amsNetIdSource,
      amsPortTarget: this.config.amsPortTarget,
    }, () => {
      this.log.info('reading ADS state');
      this.client.readState((error, result) => {
        if (error) {
          this.log.error('error: ' + error);
        } else {
          if (result.adsState === Ads.ADSSTATE.RUN) {
            this.log.info('The PLC is lucky!');
          }
          this.log.info('The state is '+ Ads.ADSSTATE.fromId(result.adsState));
        }
      });
    }) as AdsClient;

    this.client.on('error', (error) => {
      // log error
      this.log.error('Error:', error);
      this.log.info('retrying in five seconds');
      setTimeout(() => {
        this.connectToAds();
      }, 5 * 1000);
    });
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    this.connectToAds();

    let staleAccessories = this.accessories.map((x) => x);

    for(const device of this.config.accessories) {

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.name);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        staleAccessories = staleAccessories.filter((x) => x !== existingAccessory);
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', device.name);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        switch(device.type) {
          case 'adsDimmableLightbulb': {
            const ads = new AdsDimmableLightbulb(this, existingAccessory, device.symname);
            this.adsDevices.push(ads);
            break;
          }
          case 'adsLightbulb': {
            const ads = new AdsLightbulbDevice(this, existingAccessory, device.symname);
            this.adsDevices.push(ads);
            break;
          }
          case 'adsVenetianBlindEx1Switch': {
            const ads = new AdsVenetianBlindEx1Switch(this, existingAccessory, device.symname);
            this.adsDevices.push(ads);
            break;
          }
          default: {
            this.log.warn('Unknown device type', device.type);
          }
        }
        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.name);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.name, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        switch(device.type) {
          case 'adsDimmableLightbulb': {
            const ads = new AdsDimmableLightbulb(this, accessory, device.symname);
            this.adsDevices.push(ads);
            break;
          }
          case 'adsLightbulb': {
            const ads = new AdsLightbulbDevice(this, accessory, device.symname);
            this.adsDevices.push(ads);
            break;
          }
          case 'adsVenetianBlindEx1Switch': {
            const ads = new AdsVenetianBlindEx1Switch(this, accessory, device.symname);
            this.adsDevices.push(ads);
            break;
          }
          default: {
            this.log.warn('Unknown device type', device.type);
          }
        }

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }


    // unregister stale Accessories
    for(const staleAccessory of staleAccessories) {
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [staleAccessory]);
      this.log.info('Removing existing accessory from cache:', staleAccessory.displayName);
    }

    this.client.on('notification', (handle) => {
      this.log.info('notification', JSON.stringify(handle));
      this.adsDevices.forEach(obj => {
        if(obj instanceof AdsDimmableLightbulb && handle.symname.startsWith((obj as AdsDimmableLightbulb).symname)) {
          (obj as AdsDimmableLightbulb).stateChanged(handle);
        }
        if(obj instanceof AdsLightbulbDevice && (obj as AdsLightbulbDevice).symname === handle.symname) {
          (obj as AdsLightbulbDevice).stateChanged(handle);
        }
        if(obj instanceof AdsVenetianBlindEx1Switch && handle.symname.startsWith((obj as AdsVenetianBlindEx1Switch).symname)) {
          (obj as AdsVenetianBlindEx1Switch).stateChanged(handle);
        }
      });
    });
  }
}
