import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { AdsDevice } from './adsDevice';
import { AdsPlatform } from './adsPlatform';
import { AdsArrayHandle } from './decs';
import * as Ads from 'node-ads';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class AdsDimmableLightbulb extends AdsDevice {
  private service: Service;

  private states = {
    On: false,
    Brightness: 0,
  };

  constructor(
    platform: AdsPlatform,
    accessory: PlatformAccessory,
    symname: string,
  ) {
    super(platform, accessory, symname);

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Beckhoff ADS')
      .setCharacteristic(this.platform.Characteristic.Model, 'Dimmable Lightbulb')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '000000');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    this.registerForNotifications();

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))
      .onGet(this.getBrightness.bind(this));
  }

  registerForNotifications() {
    const notificationHandle = {
      symname: this.symname + '.nOut',
      bytelength: [Ads.makeType('UINT')],
    };
    this.platform.client.notify(notificationHandle);
  }

  homekitBrightness(adsBrightness: number): number {
    return adsBrightness < 1 ? 0 : Math.round( ( adsBrightness - 5000 ) / ( 32767 - 5000 ) * 100 );
  }

  adsBrightness(homekitBrightness: number): number {
    return homekitBrightness < 1 ? 0 : 5000 + homekitBrightness * (32767-5000) / 100;
  }

  stateChanged(handle: AdsArrayHandle) {
    const adsValue = handle.value[0] as number;
    this.platform.log.debug('adsValue is ' + adsValue);
    if( adsValue < 1 ) {
      this.states.On = false;
      this.states.Brightness = 0;
    } else {
      this.states.On = true;
      this.states.Brightness = this.homekitBrightness(adsValue);
    }
    this.platform.log.debug('nOut into brightness: ' + this.states.Brightness);
    this.service.updateCharacteristic(
      this.platform.Characteristic.Brightness,
      this.states.Brightness,
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.On,
      this.states.On,
    );
    this.platform.log.debug('state changed to ' + this.states.On + ', ' + this.states.Brightness);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    this.states.On = value as boolean;
    this.platform.log.debug('Setting Characteristic On ->', value);
    // HomeKit Framework will set brightness after turning it on
    // Setting the brightness to Beckhoff will automatically turn it on, so no explicit turning on is needed
    if( this.states.On ) {
      return;
    }

    const handle = {
      symname: this.symname + '.bOff',
      value: [true],
    };
    this.platform.client.write(handle, (err) => {
      if (err) {
        this.platform.log.debug('error: ' + err);
      }
    });

    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setBrightness(value: CharacteristicValue) {
    this.states.Brightness = value as number;
    this.platform.log.debug('Setting Characteristic Brightness ->', value);

    const adsValue = this.adsBrightness(this.states.Brightness);

    const handle1 = {
      bytelength: Ads.makeType('UINT'),
      symname: this.symname + '.nDimmValue',
      value: [adsValue],
    };
    const handle2 = {
      symname: this.symname + '.bSetDimmValue',
      value: [true],
    };
    this.platform.client.write(handle1, (err) => {
      if (err) {
        this.platform.log.debug('handle1 error: ' + err);
      }
      this.platform.log.debug('handle1 returned');
      this.platform.client.write(handle2, (err) => {
        if (err) {
          this.platform.log.debug('handle2 error: ' + err);
        }
        this.platform.log.debug('handle2 returned');
      });
    });

    this.platform.log.debug('Set Characteristic Brightness ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    const isOn = this.states.On;

    // request value asynchronously
    const handle = {
      symname: this.symname + '.bLight',
    };
    this.platform.log.debug('handle : ' + handle.symname);
    this.platform.client.read(handle, (err, handle) => {
      if (err) {
        this.platform.log.error('error (' + handle + '): ' + err);
        return;
      }
      this.platform.log.debug('read returned: ' + handle.value[0]);
      this.states.On = handle.value[0] as boolean;
      this.service.updateCharacteristic(
        this.platform.Characteristic.On,
        handle.value[0] as boolean);
    });

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    this.platform.log.debug('Get Characteristic On', this.symname, isOn);
    return isOn;
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getBrightness(): Promise<CharacteristicValue> {
    const brightness = this.states.Brightness;

    // request value asynchronously
    const handle = {
      bytelength: [Ads.makeType('UINT')],
      symname: this.symname + '.nOut',
    };

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    this.platform.client.read(handle, (err, handle) => {
      if (err) {
        this.platform.log.error('error: ' + err);
        return;
      }
      this.platform.log.debug('read nOut: ' + handle.value[0]);
      const adsValue = handle.value[0] as number;
      this.states.Brightness = this.homekitBrightness(adsValue);
      this.platform.log.debug('nOut into brightness: ' + this.states.Brightness);
      this.service.updateCharacteristic(
        this.platform.Characteristic.Brightness,
        this.states.Brightness,
      );
    });

    this.platform.log.debug(
      'Get Characteristic Brightness',
      this.symname,
      this.states.Brightness,
    );

    return brightness;
  }
}
