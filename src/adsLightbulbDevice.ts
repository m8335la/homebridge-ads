import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { AdsDevice } from './adsDevice';
import { AdsPlatform } from './adsPlatform';
import * as Ads from 'node-ads';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class AdsLightbulbDevice extends AdsDevice {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private states = {
    On: false,
  };

  constructor(
    platform: AdsPlatform,
    accessory: PlatformAccessory,
    symname: string,
  ) {
    super(platform, accessory, symname)

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Beckhoff ADS')
      .setCharacteristic(this.platform.Characteristic.Model, 'Simple Lightbulb')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '000000');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    this.registerForNotifications()

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
  }

  registerForNotifications() {
    let notificationHandle = {
      symname: this.symname
    };
    this.platform.client.notify(notificationHandle);
  }

  stateChanged(handle: any) {
    let value = handle.value[0]
    this.states.On = value
    this.platform.log.debug('state changed to ' + value)
    this.service.updateCharacteristic(this.platform.Characteristic.On, value)
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    this.states.On = value as boolean;
    this.platform.log.debug('Setting Characteristic On ->', value);

    var handle = {
      symname: this.symname,
      value: [value],
    };
    this.platform.client.write(handle, (err) => {
      if (err) {
        this.platform.log.debug('error: ' + err);
      }
    });

    this.platform.log.debug('Set Characteristic On ->', value);
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
    var handle = {
      symname: this.symname,
    };
    this.platform.client.read(handle, (err, handle) => {
      if (err) {
        this.platform.log.error('error: ' + err)
        return
      }
      this.platform.log.debug('read returned: ' + handle.value[0])
      this.states.On = handle.value[0]
      this.service.updateCharacteristic(this.platform.Characteristic.On, handle.value[0])
    });

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    this.platform.log.debug('Get Characteristic On', this.symname, isOn);
    return isOn;
  }

}
