import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { AdsDevice } from './adsDevice';
import { AdsPlatform } from './adsPlatform';
import * as Ads from 'node-ads';
import { AdsArrayHandle } from './decs';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class AdsVenetianBlindEx1Switch extends AdsDevice {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private states = {
    TargetPosition: 0,
    CurrentPosition: 0,
    PositionState: 2,
  };

  private targetPositionInitial = true;

  constructor(
    platform: AdsPlatform,
    accessory: PlatformAccessory,
    symname: string,
  ) {
    super(platform, accessory, symname);

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Beckhoff ADS')
      .setCharacteristic(this.platform.Characteristic.Model, 'VenetianBlindEx1Switch')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '000000');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(
      this.platform.Service.WindowCovering) ||
      this.accessory.addService(this.platform.Service.WindowCovering);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    this.registerForNotifications();

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(this.getCurrentPosition.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onSet(this.setTargetPosition.bind(this))
      .onGet(this.getTargetPosition.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .onGet(this.getPositionState.bind(this));
  }

  registerForNotifications() {
    const notificationHandleActualPosition = {
      bytelength: [Ads.makeType('USINT')],
      symname: this.symname + '.nActualPosition',
    };
    const notificationHandleUp = {
      symname: this.symname + '.bBlindUp',
    };
    const notificationHandleDown = {
      symname: this.symname + '.bBlindDown',
    };
    this.platform.client.notify(notificationHandleActualPosition);
    this.platform.client.notify(notificationHandleUp);
    this.platform.client.notify(notificationHandleDown);
  }

  stateChanged(handle: AdsArrayHandle) {
    this.platform.log.debug(handle.symname + ' -- ' + handle.value);
    const prop = handle.symname.substring(handle.symname.lastIndexOf('.'));
    this.platform.log.debug('prop', prop);
    this.platform.log.debug('json', JSON.stringify(handle));
    if (prop === '.nActualPosition') {
      let value = 0;
      if(handle.value[0] !== false) {
        value = handle.value[0] as number;
      }
      this.states.CurrentPosition = 100 - value;
      this.platform.log.debug('CurrentPosition changed to', this.states.CurrentPosition);
      this.platform.log.debug('TargetPosition is', this.states.TargetPosition);
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentPosition,
        this.states.CurrentPosition,
      );
      if( this.targetPositionInitial ) {
        this.targetPositionInitial = false;
        this.states.TargetPosition = this.states.CurrentPosition;
        this.service.updateCharacteristic(
          this.platform.Characteristic.TargetPosition,
          this.states.TargetPosition,
        );
      }

      // work around
      if( this.states.CurrentPosition === this.states.TargetPosition ) {
        this.states.PositionState = 2; // stopped
        this.platform.log.debug('PositionState changed to ', this.states.PositionState);
        this.service.updateCharacteristic(
          this.platform.Characteristic.PositionState,
          this.states.PositionState,
        );
      }
    }
    if (prop === '.bBlindUp' || prop === '.bBlindDown') {
      this.states.PositionState = 2; // stopped
      if (prop === '.bBlindUp' && handle.value[0]) {
        this.states.PositionState = 2; // 1 going to max
      }
      if (prop === '.bBlindDown' && handle.value[0]) {
        this.states.PositionState = 2; // going to min
      }
      this.platform.log.debug('PositionState changed to ', this.states.PositionState);
      this.service.updateCharacteristic(
        this.platform.Characteristic.PositionState,
        this.states.PositionState,
      );
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setTargetPosition(value: CharacteristicValue) {
    this.states.TargetPosition = value as number;

    this.platform.log.debug('Setting Characteristic Target Position ->', value);

    const handle = {
      bytelength: Ads.makeType('USINT'),
      symname: this.symname + '.nSetPosition',
      value: [100-this.states.TargetPosition],
    };
    this.platform.log.debug('handle1', JSON.stringify(handle));
    this.platform.client.write(handle, (err) => {
      if (err) {
        this.platform.log.debug('error: ' + err);
      }
      this.platform.log.debug('handle1 returned');
      const handle2 = {
        symname: this.symname + '.bPosition',
        value: [true],
      };
      this.platform.log.debug('handle2', JSON.stringify(handle));
      this.platform.client.write(handle2, (err) => {
        if (err) {
          this.platform.log.debug('error: ' + err);
        }
        this.platform.log.debug('handle2 returned');
      });
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
  async getTargetPosition(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      'Get Characteristic TargetPosition',
      this.symname,
      this.states.TargetPosition);
    return this.states.TargetPosition;
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
  async getCurrentPosition(): Promise<CharacteristicValue> {
    // request value asynchronously
    const handle = {
      bytelength: [Ads.makeType('USINT')],
      symname: this.symname + '.nActualPosition',
    };

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    this.platform.client.read(handle, (err, handle) => {
      if (err) {
        this.platform.log.error('error: ' + err);
        return;
      }
      this.platform.log.debug('read getCurrentPosition: ' + JSON.stringify(handle));
      this.platform.log.debug('read getCurrentPosition returned: ' + handle.value[0]);
      this.states.CurrentPosition = 100 - (handle.value[0] as number);
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentPosition,
        this.states.CurrentPosition,
      );
    });

    this.platform.log.debug(
      'Get Characteristic CurrentPosition',
      this.symname,
      this.states.CurrentPosition,
    );
    return this.states.CurrentPosition;
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
  async getPositionState(): Promise<CharacteristicValue> {
    // request value asynchronously
    const handle = {
      symname: this.symname + '.bBlindUp',
    };
    this.platform.client.read(handle, (err, handle) => {
      if (err) {
        this.platform.log.error('error: ' + err);
        return;
      }
      if(handle.value[0]) {
        this.states.PositionState = 2;
        this.service.updateCharacteristic(
          this.platform.Characteristic.PositionState,
          this.states.PositionState,
        );
        return;
      }
      const handle2 = {
        symname: this.symname + '.bBlindDown',
      };
      this.platform.client.read(handle2, (err, handle3) => {
        if (err) {
          this.platform.log.error('error: ' + err);
          return;
        }
        if(handle3.value[0]) {
          this.states.PositionState = 2;
        } else {
          this.states.PositionState = 2;
        }
        this.platform.log.info('updateCharacteristic PositionState' + this.states.PositionState);
        this.service.updateCharacteristic(
          this.platform.Characteristic.PositionState,
          this.states.PositionState,
        );
        return;
      });
    });

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    this.platform.log.debug(
      'Get Characteristic PositionState',
      this.symname,
      this.states.PositionState,
    );
    return this.states.PositionState;
  }
}
