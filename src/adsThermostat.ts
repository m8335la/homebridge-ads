import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { AdsDevice } from './adsDevice';
import { AdsPlatform } from './adsPlatform';
import { } from 'hap-nodejs/dist/lib/definitions';
import * as NodeDhtSensor from 'node-dht-sensor';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class AdsThermostat extends AdsDevice {
  private service: Service;

  private dhtSensorPin: number;
  private dhtSensorType: number;

  private states = {
    CurrentHeatingCoolingState: this.platform.Characteristic.CurrentHeatingCoolingState.OFF,
    CurrentRelativeHumidity: 42.42,
    CurrentTemperature: 14.2,
    TargetHeatingCoolingState: this.platform.Characteristic.TargetHeatingCoolingState.OFF,
    TargetTemperature: 24.2,
  };

  private sensor = NodeDhtSensor.promises;

  constructor(
    platform: AdsPlatform,
    accessory: PlatformAccessory,
    symname: string,
    dhtSensorPin: number,
    dhtSensorType: number,
  ) {
    super(platform, accessory, symname);
    this.dhtSensorPin = dhtSensorPin;
    this.dhtSensorType = dhtSensorType;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Beckhoff ADS')
      .setCharacteristic(this.platform.Characteristic.Model, 'Thermostat')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '000000');

    // get the service if it exists, otherwise create a new service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.setTargetHeatingCoolingState.bind(this))
      .onGet(this.getTargetHeatingCoolingState.bind(this))
      .setProps({
        validValues: [
          this.platform.Characteristic.TargetHeatingCoolingState.OFF,
          this.platform.Characteristic.TargetHeatingCoolingState.HEAT,
        ],
      });
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(this.setTargetTemperature.bind(this))
      .onGet(this.getTargetTemperature.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this));

    // this.sensor.initialize({
    //   test: {
    //     fake: {
    //       temperature: 19.9,
    //       humidity: 60,
    //     },
    //   },
    // });

    this.poll();
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
  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    this.platform.log.debug('getCurrentHeatingCoolingState');
    this.platform.log.debug('TargetHeatingCoolingState ->', this.states.TargetHeatingCoolingState);
    this.platform.log.debug('CurrentHeatingCoolingState ->', this.states.CurrentHeatingCoolingState);


    return this.states.CurrentHeatingCoolingState;
  }

  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    return this.states.TargetHeatingCoolingState;
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    this.states.TargetHeatingCoolingState = value as number;
    this.platform.log.debug('setTargetHeatingCoolingState ->', value);
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    return this.states.TargetTemperature;
  }

  async setTargetTemperature(value: CharacteristicValue) {
    this.states.TargetTemperature = value as number;
    this.platform.log.debug('setTargetTemperature ->', value);
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    return this.states.CurrentTemperature;
  }

  async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
    return this.states.CurrentRelativeHumidity;
  }

  poll() {
    this.sensor.read(this.dhtSensorType, this.dhtSensorPin).then(
      (res) => {
        this.platform.log.debug(
          `temp: ${res.temperature.toFixed(1)}°C, ` +
          `humidity: ${res.humidity.toFixed(1)}%`,
        );

        this.states.CurrentTemperature = res.temperature.toFixed(1);
        this.states.CurrentRelativeHumidity = res.humidity.toFixed(1);

        let handleValue = false;

        // evaluate current mode
        if(this.states.TargetHeatingCoolingState === this.platform.Characteristic.TargetHeatingCoolingState.OFF
          || this.states.TargetTemperature <= this.states.CurrentTemperature) {
          // set to off
          this.states.CurrentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
          this.platform.log.debug('turning it OFF...');
        } else {
          // turn on
          this.states.CurrentHeatingCoolingState = this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
          handleValue = true;
          this.platform.log.debug('turning it ON...');
        }

        const handle = {
          symname: this.symname,
          value: [handleValue],
        };
        this.platform.client.write(handle, (err) => {
          if (err) {
            this.platform.log.error('error: ' + err);
          }
        });

        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentHeatingCoolingState,
          this.states.CurrentHeatingCoolingState,
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentRelativeHumidity,
          this.states.CurrentRelativeHumidity,
        );
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          this.states.CurrentTemperature,
        );

        setTimeout(() => {
          this.poll();
        }, 5000);
      },
      (err) => {
        this.platform.log.warn('Failed to read sensor (PIN %s) data:', this.dhtSensorPin, err);
        setTimeout(() => {
          this.poll();
        }, 5000);
      },
    );
  }
}