import { BaseSdk } from "./BaseSdk";
import { BANNER_STATE, CbResultData, CbResultVal, INTERSTITIAL_STATE, REWARDED_STATE } from "./types";
import { addJavaScript } from "./utils";

const SDK_URL = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js'

export class VkSdk extends BaseSdk {
    _platformId = 'vk';
    _isPlayerAuthorized = true;
    private _platformSdk: any;


    constructor(cb_ready: CbResultVal) {
        super(() => { });

        let url = new URL(window.location.href)
        if (url.searchParams.has('platform')) {
            this.platform = url.searchParams.get('platform')
        }
        addJavaScript(SDK_URL).then(() => {
            this._platformSdk = (window as any).vkBridge;

            this._platformSdk.send('VKWebAppInit').then(() => {
                this._isBannerSupported = true

                this._platformSdk.send('VKWebAppGetUserInfo')
                    .then(data => {
                        if (data) {
                            this._playerId = data['id']
                            this._playerName = data['first_name'] + ' ' + data['last_name']

                            if (data['photo_100'])
                                this._playerPhotos.push(data['photo_100'])
                            if (data['photo_200'])
                                this._playerPhotos.push(data['photo_200'])
                            if (data['photo_max_orig'])
                                this._playerPhotos.push(data['photo_max_orig'])
                        }
                    })
                    .finally(() => {
                        this.load_all_data_from_storage(cb_ready);
                    })

            })
            if (this.platform == '') {
                this._platformSdk.send('VKWebAppGetClientVersion')
                    .then((result) => {
                        if (result) {
                            this.platform = result.platform;
                        }
                    })
                    .catch((error) => {
                        this.error(error);
                    });
            }
        })
    }


    is_favorite_supported() {
        return true;
    }

    is_share_supported() {
        return true
    }

    send_request_to_vk_bridge(actionName, vkMethodName, parameters = {}, responseSuccessKey = 'result') {
        return new Promise((resolve, reject) => {
            this._platformSdk.send(vkMethodName, parameters)
                .then(data => {
                    if (data[responseSuccessKey])
                        resolve(true)
                    else
                        resolve(false)
                })
                .catch(error => {
                    this.error(error);
                    resolve(false)
                })
        })
    }

    get_language() {
        let url = new URL(window.location.href)
        if (url.searchParams.has('language')) {
            let language: number | string = url.searchParams.get('language')
            try { language = parseInt(language) }
            catch (e) { }

            switch (language) {
                case 0: {
                    return 'ru'
                }
                case 1: {
                    return 'uk'
                }
                case 2: {
                    return 'be'
                }
                case 3: {
                    return 'en'
                }
            }
        }

        return super.get_language()
    }

    get_payload() {
        let url = new URL(window.location.href)
        if (url.searchParams.has('hash'))
            return url.searchParams.get('hash')
        return super.get_payload();
    }

    load_all_data_from_storage(cb: CbResultVal) {
        this._platformStorageCachedData = {}; // инициализируем тут, иначе не будет работать получение/установка кеш ключа
        this._platformSdk.send('VKWebAppStorageGetKeys', { count: 50, offset: 0 })
            .then(data => {
                if (data.keys.length > 0) {
                    this.get_data_from_storage({ key: data.keys }, (result, data_arr) => {
                        if (result) {
                            for (let i = 0; i < data.keys.length; i++) {
                                this._platformStorageCachedData[data.keys[i]] = data_arr[i];
                            }
                        }
                        cb(result);
                    }, false);
                }
                else
                    return cb(false)
            })
            .catch(error => {
                this.error(error)
                cb(false);
            })
    }

    get_data_from_storage(params: { key: string | string[] }, cb: CbResultData, use_cache = false) {
        if (use_cache) {
            const tmp = this._get_cached_storage(params);
            if (tmp[0] === true) {
                return cb(true, tmp[1]);
            }
        }
        let keys = Array.isArray(params.key) ? params.key : [params.key];

        this._platformSdk.send('VKWebAppStorageGet', { keys })
            .then(data => {
                if (Array.isArray(params.key)) {
                    // тут другой порядок ключей в ответе может быть, поэтому нужно правильно преобразовать
                    const tmp: { [k: string]: any } = {};
                    for (let i = 0; i < data.keys.length; i++) {
                        const kv = data.keys[i];
                        if (kv.value === '')
                            tmp[kv.key] = null;
                        else
                            tmp[kv.key] = this.decode_storage_value(kv.value);
                    }

                    let values = []
                    for (let i = 0; i < params.key.length; i++)
                        values.push(tmp[params.key[i]]);
                    return cb(true, values);
                }
                return cb(true, data.keys[0].value === '' ? null : this.decode_storage_value(data.keys[0].value));
            })
            .catch(error => {
                if (error && error.error_data && error.error_data.error_reason)
                    this.error(error.error_data.error_reason)
                cb(false, null);
            })
    }

    _set_key_val_to_storage(params: { key: string, value: any }, cb: CbResultVal) {
        // заносим сразу чтобы можно было мгновенно в ответе знать результат
        if (this._platformStorageCachedData != null)
            this._platformStorageCachedData[params.key] = params.value
        this._platformSdk.send('VKWebAppStorageSet', { key: params.key, value: this.encode_storage_value(params.value) })
            .then(() => {
                cb(true)
            })
            .catch(error => {
                if (error && error.error_data && error.error_data.error_reason)
                    this.error(error.error_data.error_reason)
                cb(false)
            })
    }

    _set_key_val_to_storage_promise(params: { key: string, value: any }) {
        return new Promise((resolve, reject) => {
            this._set_key_val_to_storage(params, resolve);
        })
    }

    set_data_to_storage(params: { key: string | string[], value: any }, cb: CbResultVal) {
        if (Array.isArray(params.key)) {
            let promises = []
            for (let i = 0; i < params.key.length; i++) {
                let data = { key: params.key[i], value: params.value[i] }
                promises.push(this._set_key_val_to_storage_promise(data))
            }
            Promise.all(promises).then(() => cb(true));
        } else {
            this._set_key_val_to_storage({ key: params.key, value: params.value }, cb);
        }
    }


    delete_data_from_storage(params: { key: string }, cb: CbResultVal) {
        if (Array.isArray(params.key)) {
            let promises = []
            for (let i = 0; i < params.key.length; i++)
                promises.push(this._set_key_val_to_storage_promise({ key: params.key[i], value: '' }))
            Promise.all(promises).then(() => cb(true))
        } else {
            return this.set_data_to_storage({ key: params.key, value: '' }, cb);
        }
    }


    share(params: { link: string }, cb: CbResultVal) {
        let parameters: any = {}
        if (params && params.link)
            parameters.link = params.link
        this.send_request_to_vk_bridge('share', 'VKWebAppShare', parameters, 'type')
            .then((r: boolean) => {
                cb(r);
            })
    }


    add_to_favorites(cb: CbResultVal) {
        this.send_request_to_vk_bridge('add_to_favorites', 'VKWebAppAddToFavorites')
            .then((r: boolean) => {
                cb(r);
            })
    }

    show_banner(params?: any) {
        let position = 'bottom'
        let layoutType = 'resize'
        let canClose = false

        if (params) {
            if (typeof params.position === 'string') {
                position = params.position
            }

            if (typeof params.layoutType === 'string') {
                layoutType = params.layoutType
            }

            if (typeof params.canClose === 'boolean') {
                canClose = params.canClose
            }
        }

        this._platformSdk.send('VKWebAppShowBannerAd', { 'banner_location': position, 'layout_type': layoutType, 'can_close': canClose })
            .then(data => {
                if (data.result) {
                    this._setBannerState(BANNER_STATE.SHOWN)
                } else {
                    this._setBannerState(BANNER_STATE.FAILED)
                }
            })
            .catch(error => {
                this._setBannerState(BANNER_STATE.FAILED)
            })
    }


    hide_banner() {
        this._platformSdk.send('VKWebAppHideBannerAd')
            .then(data => {
                if (data.result) {
                    this._setBannerState(BANNER_STATE.HIDDEN)
                }
            })
    }

    show_interstitial() {
        this._platformSdk
            .send('VKWebAppCheckNativeAds', { ad_format: 'interstitial' })
            .then(data => {
                if (data.result) {
                    this._set_interstitial_state(INTERSTITIAL_STATE.OPENED)
                }
            })
            .finally(() => {
                this._platformSdk
                    .send('VKWebAppShowNativeAds', { ad_format: 'interstitial' })
                    .then(data => {
                        this._set_interstitial_state(data.result ? INTERSTITIAL_STATE.CLOSED : INTERSTITIAL_STATE.FAILED)
                    })
                    .catch(() => {
                        this._set_interstitial_state(INTERSTITIAL_STATE.FAILED)
                    })
            })
    }

    show_rewarded() {
        this._platformSdk
            .send('VKWebAppCheckNativeAds', { ad_format: 'reward', use_waterfall: true })
            .then(data => {
                if (data.result) {
                    this._set_rewarded_state(REWARDED_STATE.OPENED)
                }
            })
            .finally(() => {
                this._platformSdk
                    .send('VKWebAppShowNativeAds', { ad_format: 'reward', use_waterfall: true })
                    .then(data => {
                        if (data.result) {
                            this._set_rewarded_state(REWARDED_STATE.REWARDED)
                            this._set_rewarded_state(REWARDED_STATE.CLOSED)
                        } else {
                            this._set_rewarded_state(REWARDED_STATE.FAILED)
                        }
                    })
                    .catch(() => {
                        this._set_rewarded_state(REWARDED_STATE.FAILED)
                    })
            })
    }

}