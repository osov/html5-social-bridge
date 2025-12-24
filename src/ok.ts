import { BaseSdk } from "./BaseSdk";
import { BANNER_STATE, CbResultData, CbResultVal, INTERSTITIAL_STATE, REWARDED_STATE } from "./types";
import { addJavaScript } from "./utils";

const SDK_URL = 'https://api.ok.ru/js/fapi5.js';


export class OkSdk extends BaseSdk {
    _platformId = 'ok';
    _platformSdk: any;
    _bannerVisible = false;
    _isPlayerAuthorized = true;

    constructor(cb_ready: CbResultVal) {
        super(() => { });
        this.check_ad_block();
        addJavaScript(SDK_URL).then(() => {
            this._platformSdk = (window as any).FAPI;

            (window as any).API_callback = (method: string, result: string, data: any) => {

                this.log('API_callback', method, result, data);

                // ответ на загрузку Reward
                if (method == 'loadAd') {
                    if (result == 'ok') {
                        this._set_rewarded_state(REWARDED_STATE.OPENED);
                        this._platformSdk.UI.showLoadedAd();
                    }
                    else {
                        this.warn('reward[loadAd]', result, data);
                        this._set_rewarded_state(REWARDED_STATE.FAILED);
                    }
                }
                // ответ на показ Reward
                if (method == 'showLoadedAd') {
                    if (result == 'ok') {
                        this._set_rewarded_state(REWARDED_STATE.REWARDED);
                    }
                    else {
                        this.warn('reward[showLoadedAd]', result, data);
                    }
                    this._set_rewarded_state(REWARDED_STATE.CLOSED);
                }


                // ответ на показ интера
                if (method == 'showAd') {
                    if (result == 'ok' && data == 'ad_shown') {

                    }
                    else {
                        this.warn('inter[showAd]', result, data);
                    }
                    this._set_interstitial_state(INTERSTITIAL_STATE.CLOSED);
                }

                // баннер
                if (method == 'requestBannerAds') {
                    if (result == 'ok' && data == 'ad_loaded') {
                        if (this._bannerVisible) {
                            this._platformSdk.invokeUIMethod("showBannerAds", "bottom");
                        }
                        else
                            this.warn("[requestBannerAds] Banner state not visible, not showing");
                    }
                    // вернуть статус чтобы потом отрабатывал смену
                    if (result == 'error')
                        this._setBannerState(BANNER_STATE.FAILED);
                    // если не поддерживается то не крутим запросы
                    if (result == 'error' && (data == 'disabled' || data == 'not_supported')) {
                        this._isBannerSupported = false;
                        this.warn('[requestBannerAds] banner not supported');
                    }

                    if (result == 'ok' && data == 'banner_shown') {

                    }
                }
                // ответ на показать баннер
                if (method == 'showBannerAds') {
                    if (result == 'ok') {
                        if (data == 'true')
                            this._setBannerState(BANNER_STATE.SHOWN);
                        else if (data == 'false')
                            this._setBannerState(BANNER_STATE.FAILED);
                    }
                }
                // ответ на скрыть баннер
                if (method == 'hideBannerAds') {
                    if (data == 'true')
                        this._setBannerState(BANNER_STATE.HIDDEN);
                    else if (data == 'false' || data == 'not_initialized')
                        this._setBannerState(BANNER_STATE.FAILED);
                }

                // чекаем статус баннера
                if (method == 'isBannerAdsVisible') {
                    if (result == 'ok') {
                        if (data == 'true' && !this._bannerVisible) {
                            this.warn('[isBannerAdsVisible] Баннер показан, но не должен быть');
                        }
                        if (data == 'false' && this._bannerVisible) {
                            this.log('[isBannerAdsVisible] возобновляем показ баннера');
                            this._platformSdk.invokeUIMethod("requestBannerAds");
                        }
                    }
                }

                if (method == 'getPageInfo') {
                    if (result == 'ok') {
                        const info = JSON.parse(data);
                        const sub_height = (window as any).sub_height == undefined ? 100 : (window as any).sub_height;
                        const h = info.innerHeight;
                        this._platformSdk.UI.setWindowSize(540, h - sub_height);
                    }
                }

                if (method == 'showPayment') {
                    console.log('showPayment', result, data);
                }

            };

            const rParams = this._platformSdk.Util.getRequestParameters();
            this._platformSdk.init(rParams["api_server"], rParams["apiconnection"],
                /* функция, которая будет вызвана после успешной инициализации. */
                () => {
                    this.log("Инициализация прошла успешно [OK]");
                    // здесь можно вызывать методы API
                    const isMob = this._platformSdk.Util.getRequestParameters().mob == 'true';

                    this._isBannerSupported = isMob;
                    this._playerId = rParams['logged_user_id'];
                    this._playerName = rParams['user_name'];
                    this._playerPhotos = [rParams['user_image'] as string];
                    this.load_all_data_from_storage(cb_ready);
                },
                /*функция, которая будет вызвана, если инициализация не удалась. */
                function (error) {
                    this.error("Ошибка инициализации", error);
                    cb_ready(false);
                }
            );
            //  }, 10);
        });

    }

    is_share_supported() {
        return true;
    }

    share(options) {
        return this.send_request_to_ok_bridge('share', 'showInvite', options.link);
    }

    send_request_to_ok_bridge(actionName: string, methodName: string, parameters = {}) {
        return new Promise((resolve, reject) => {
            try {
                this._platformSdk.UI[methodName](parameters);
                resolve(true);
            }
            catch (error) {
                this.error(error);
                resolve(false);
            }
        });
    }

    _update_resize(is_vert: boolean) {
        // если это ПК версия
        if (this._platformSdk.Util.getRequestParameters().mob != 'true') {
            this._platformSdk.UI.getPageInfo();
            return;
        }
        const html = '<div class="screen-manager" style="width: 100%;height: 100%;position: fixed;z-index: 999; background: #000000d9;"><div style="width: 500px;left: 50%;position: absolute;margin-left: -250px;color: #fff;top: 40%;text-align: center;"><h2>Поверните устройство</h2><h3>Игра работает только в <br>' + (is_vert ? "вертикальной" : "горизонтальной") + ' ориентации</h3></div></div>';
        const w = window.innerWidth;
        const h = window.innerHeight;
        const nodes = document.querySelectorAll('.screen-manager');
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            n.remove();
        }
        if (w > h && is_vert)
            document.body.insertAdjacentHTML('beforeend', html);

        if (h > w && !is_vert)
            document.body.insertAdjacentHTML('beforeend', html);
    }

    start_resize_monitor(params: { is_vert: boolean }) {
        window.addEventListener("resize", () => this._update_resize(params.is_vert), true);
        this._update_resize(params.is_vert);
    }

    load_all_data_from_storage(cb: CbResultVal) {
        this._platformStorageCachedData = {};
        this._platformSdk.Client.call({ "method": "storage.getKeys", scope: 'CUSTOM' }, (status, data, error) => {
            if (status == 'ok' && error == null) {
                if (data.keys.length == 0) {
                    return cb(true);
                }
                this.get_data_from_storage({ key: data.keys }, (result, data_arr) => {
                    if (result) {
                        for (let i = 0; i < data.keys.length; i++) {
                            this._platformStorageCachedData[data.keys[i]] = data_arr[i];
                        }
                    }
                    cb(result);
                }, false);
            } else {
                this.error('status:', status, 'data:', data, 'error:', error);
                return cb(false);
            }
        });
    }

    delete_old_storage_data(keys: string[], min_keys = 0) {
        if (keys.length > min_keys && keys.length > 0) {
            this.log('check delete old storage data...', keys);
            const del_ids: string[] = [];
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (key.indexOf('_v2') == -1)
                    del_ids.push(key);
            }
            if (del_ids.length > 0) {
                this.log('delete old storage data:', del_ids);
                this.delete_data_from_storage({ key: del_ids }, () => this.log('delete old storage data finished'));
            }
            else
                this.log('delete old storage data not required');
        }
    }


    get_data_from_storage(params: { key: string | string[] }, cb: CbResultData, use_cache = false) {
        if (use_cache) {
            const tmp = this._get_cached_storage(params);
            if (tmp[0] === true) {
                return cb(true, tmp[1]);
            }
        }
        const keys = Array.isArray(params.key) ? params.key : [params.key];
        this._platformSdk.Client.call({ "method": "storage.get", keys, scope: 'CUSTOM' }, (status, data, error) => {
            if (status == 'ok' && error == null) {
                if (Array.isArray(params.key)) {
                    // тут другой порядок ключей в ответе может быть, поэтому нужно правильно преобразовать
                    const tmp: { [k: string]: any } = {};
                    for (const k in data.data) {
                        const value = data.data[k];
                        tmp[k] = this.decode_storage_value(value);
                    }
                    const values = [];
                    for (let i = 0; i < params.key.length; i++)
                        values.push(tmp[params.key[i]]);
                    return cb(true, values);
                }
                return cb(true, this.decode_storage_value(data.data[params.key]));
            }
            else {
                this.error('status:', status, 'data:', data, 'error:', error);
                cb(false, null);
            }
        });
    }

    _set_key_val_to_storage(params: { key: string, value: any }, cb: CbResultVal) {
        if (this._platformStorageCachedData != null)
            this._platformStorageCachedData[params.key] = params.value;
        this._platformSdk.Client.call({ "method": "storage.set", key: params.key, value: this.encode_storage_value(params.value) }, (status, data, error) => {
            if (status == 'ok' && error == null) {
                cb(true);
            }
            else {
                this.error('save status:', status, 'data:', data, 'error:', error);
                cb(false);
            }
        });
    }

    _set_key_val_to_storage_promise(params: { key: string, value: any }) {
        return new Promise((resolve, reject) => {
            this._set_key_val_to_storage(params, resolve);
        });
    }


    set_data_to_storage(params: { key: string | string[], value: any }, cb: CbResultVal) {
        if (Array.isArray(params.key)) {
            const promises = [];
            for (let i = 0; i < params.key.length; i++)
                promises.push(this._set_key_val_to_storage_promise({ key: params.key[i], value: params.value[i] }));
            Promise.all(promises).then(() => cb(true));
        } else {
            this._set_key_val_to_storage({ key: params.key, value: params.value }, cb);
        }
    }

    // удаляет ключ или массив ключей
    delete_data_from_storage(params: { key: string | string[] }, cb: CbResultVal) {
        if (Array.isArray(params.key)) {
            const promises = [];
            for (let i = 0; i < params.key.length; i++)
                promises.push(this._set_key_val_to_storage_promise({ key: params.key[i], value: '' }));
            Promise.all(promises).then(() => cb(true));
        } else {
            return this.set_data_to_storage({ key: params.key, value: '' }, cb);
        }
    }



    check_and_migrate_data(params: { keys: string[], data: { [k: string]: any } }, cb: CbResultVal) {
        this.log('check migrate [OK]...');

        // данных нет, ничего не мигрируем
        if (this._platformStorageCachedData == null || Object.keys(this._platformStorageCachedData).length == 0) {
            this.log('migrate not required, not data');
            return cb(true);
        }

        if (this._platformStorageCachedData['is_sound'] == null) {
            this.log('migrate not required ?');
            return cb(true);
        }

        // ключ уже в новом формате хранится
        if (JSON.stringify(this._platformStorageCachedData['is_sound']).indexOf('value') == -1) {
            this.log('migrate not required');
            return cb(true);
        }

        const keys = [];
        const values = [];
        for (const k in this._platformStorageCachedData) {
            const val = this._platformStorageCachedData[k].value;
            keys.push(k);
            values.push(val);
        }
        // формат старый, надо перезаписать
        this.set_data_to_storage({ key: keys, value: values }, (result) => {
            this.log('migrate finished', result);
            cb(result);
        });
    }

    show_interstitial() {
        this._set_interstitial_state(INTERSTITIAL_STATE.OPENED); // меняем состояние, хотя по факту он может не запуститься
        this._platformSdk.UI.showAd();                         // потому что узнаем об успехе запуска лишь после успешного показа
    }

    show_rewarded() {
        this._platformSdk.UI.loadAd();
    }

    game_ready() {
        //
    }

    init_purchases(params: any, cb: CbResultData) {
        this.get_catalog({}, cb);
    }

    get_catalog(params: any, cb: CbResultData) {
        cb(true, []);
    }

    get_purchases(params: any, cb: CbResultData) {
        return cb(false, null);
    }

    purchase(params: { id: string, developerPayload?: string, price?: number, valute?: string }, cb: CbResultData) {
        this._platformSdk.UI.showPayment(
            `Изумруды x${params.id}`,  // название
            `Пакет изумрудов`,            // описание
            params.id,                  // код товара: "300", "1000", "3500"
            params.price,               // цена в OK-коинах
            null,                          // доп. атрибуты
            params.valute != undefined ? params.valute : 'ok',                          // валюта
            'true'                         // показать диалог
        );
    }

    consume_purchase(params: { token: string }, cb: CbResultData) {

    }

}