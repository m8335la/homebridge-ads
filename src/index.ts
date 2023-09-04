import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { AdsPlatform } from './adsPlatform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, AdsPlatform);
};
