import { BANNER_STATE, CbBannerState, CbInterstitialState, CbLeaderboardList, CbResultData, CbResultVal, CbRewardedState, CbVisibleState, INTERSTITIAL_STATE, REWARDED_STATE } from "./types";



export class BaseSdk {

    protected _localStorage = null;
    protected _isPlayerAuthorized = false;
    protected _playerId = '';
    protected _playerName = '';
    protected _playerPhotos: string[] = [];
    protected _isBannerSupported = false;
    protected _platformStorageCachedData = null;
    protected _has_ad_block = false;
    protected _platformId = '';
    protected platform = '';
    protected _visibilityState: boolean;
    protected cb_visible_state: CbVisibleState;

    protected cb_interstitial_state: CbInterstitialState;
    protected cb_banner_state: CbBannerState;
    protected cb_rewarded_state: CbRewardedState;
    protected _interstitialState: INTERSTITIAL_STATE;
    protected _rewardedState: REWARDED_STATE;
    protected _bannerState: BANNER_STATE;


    constructor(cb_ready: CbResultVal, is_load_data_from_storage = false) {
        try { this._localStorage = window.localStorage; } catch (e) { }
        this._visibilityState = document.visibilityState == 'visible';
        document.addEventListener('visibilitychange', () => {
            this._visibilityState = document.visibilityState == 'visible';
            if (this.cb_visible_state)
                this.cb_visible_state(this._visibilityState);
        });
        if (is_load_data_from_storage)
            this.load_all_data_from_storage(cb_ready);
        else
            cb_ready(true);
    }

    log(...args) {
        console.log('platform-bridge:', ...args);
    }

    warn(...args) {
        console.warn('platform-bridge:', ...args);
    }
    error(...args) {
        console.error('platform-bridge:', ...args);
    }

    get_platform() {
        return this._platformId;
    }

    get_platform_device() {
        return this.platform;
    }

    get_platform_tld() {
        return '';
    }

    get_language() {
        const value = navigator.language;
        if (typeof value === 'string') {
            return value.substring(0, 2).toLowerCase();
        }
        return 'en';
    }

    get_payload() {
        const url = new URL(window.location.href);
        return url.searchParams.get('payload');
    }

    is_favorite_supported() {
        return false;
    }

    is_share_supported() {
        return false;
    }

    // player

    is_player_authorized() {
        return this._isPlayerAuthorized;
    }

    player_id() {
        return this._playerId;
    }

    player_name() {
        return this._playerName;
    }

    player_photos() {
        return this._playerPhotos;
    }

    // storage

    _get_data_from_local_storage(key: string) {
        const value = this._localStorage.getItem(key);
        return this.decode_storage_value(value);
    }

    _set_data_to_local_storage(key: string, value: any) {
        this._localStorage.setItem(key, this.encode_storage_value(value));
        // cache
        if (this._platformStorageCachedData != null)
            this._platformStorageCachedData[key] = value;
    }

    _delete_data_from_local_storage(key: string) {
        this._localStorage.removeItem(key);
        delete this._platformStorageCachedData[key];
    }


    encode_storage_value(value: any) {
        if (typeof value !== 'string')
            value = JSON.stringify(value);
        return value;
    }

    decode_storage_value(value: any) {
        if (typeof value === 'string') {
            try {
                value = JSON.parse(value);
            }
            catch (e) { }
        }
        return value;
    }

    get_cached_key(params: { key: string | string[] }) {
        return this._get_cached_storage(params);
    }

    _get_cached_storage(params: { key: string | string[] }) {
        if (this._platformStorageCachedData) {
            if (Array.isArray(params.key)) {
                const values = [];
                for (let i = 0; i < params.key.length; i++) {
                    const value = typeof this._platformStorageCachedData[params.key[i]] === 'undefined' ? null : this._platformStorageCachedData[params.key[i]];
                    values.push(value);
                }
                return [true, values];
            }
            const value = typeof this._platformStorageCachedData[params.key] === 'undefined' ? null : this._platformStorageCachedData[params.key];
            return [true, value];
        }
        return [false, null];
    }

    load_all_data_from_storage(cb: CbResultVal) {
        if (!this._localStorage)
            return cb(false);
        const keys = Object.keys(this._localStorage);
        this.get_data_from_storage({ key: keys }, (status, data_arr) => {
            if (status) {
                this._platformStorageCachedData = {};
                for (let i = 0; i < keys.length; i++) {
                    this._platformStorageCachedData[keys[i]] = data_arr[i];
                }
            }
            cb(status);
        }, false);
    }

    get_data_from_storage(params: { key: string | string[] }, cb: CbResultData, use_cache = false) {
        if (!this._localStorage) {
            this.error('localStorage is not supported');
            return cb(false, null);
        }
        if (Array.isArray(params.key)) {
            const values = [];
            for (let i = 0; i < params.key.length; i++) {
                values.push(this._get_data_from_local_storage(params.key[i]));
            }
            return cb(true, values);
        }
        const value = this._get_data_from_local_storage(params.key);
        return cb(true, value);
    }

    set_data_to_storage(params: { key: string | string[], value: any }, cb: CbResultVal) {
        if (!this._localStorage) {
            this.error('localStorage is not supported');
            return cb(false);
        }

        if (Array.isArray(params.key)) {
            for (let i = 0; i < params.key.length; i++) {
                this._set_data_to_local_storage(params.key[i], params.value[i]);
            }
            return cb(true);
        }

        this._set_data_to_local_storage(params.key, params.value);
        return cb(true);
    }

    delete_data_from_storage(params: { key: string | string[] }, cb: CbResultVal) {
        if (!this._localStorage) {
            this.error('localStorage is not supported');
            return cb(false);
        }

        if (Array.isArray(params.key)) {
            for (let i = 0; i < params.key.length; i++) {
                this._delete_data_from_local_storage(params.key[i]);
            }
            return cb(true);
        }

        this._delete_data_from_local_storage(params.key);
        return cb(true);
    }

    check_and_migrate_data(params: { keys: string[], data: { [k: string]: any } }, cb: CbResultVal) {
        this.log('check migrate...', params);
        this.get_data_from_storage({ key: params.keys }, (success, result: any[]) => {
            if (success) {
                this.log('loaded check data...', result);
                // какие-то данные уже есть(если не null), значит миграция не нужна
                if (result.filter(x => x != null).length > 0) {
                    this.log('migrate not required');
                    return cb(true);
                }
                // данных нет, заносим
                // хак в том что с луа сюда null не приходит О_о
                const values = [];
                for (let i = 0; i < params.keys.length; i++) {
                    const k = params.keys[i];
                    const d = params.data[k];
                    if (d == undefined)
                        values.push(null);
                    else
                        values.push(d);

                }
                this.set_data_to_storage({ key: params.keys, value: values }, (result2) => {
                    this.log('migrate finished', result2);
                    cb(result2);
                });
            }
            else {
                this.log('migrate failed');
                cb(false);
            }
        }, false);
    }

    // social

    share(params?: any, cb?: CbResultVal) {
        if (cb)
            cb(false);
    }

    rate(cb: CbResultVal) {
        cb(false);
    }

    add_to_favorites(cb?: CbResultVal) {
        if (cb)
            cb(false);
    }

    // leaderboard
    set_leaderboard_score(params: { leaderboardName: string, score: number, extraData?: any }, cb: CbResultVal) {
        cb(false);
    }

    get_leaderboard_score(params: { leaderboardName: string }, cb: CbResultData) {
        cb(false, null);
    }

    get_leaderboard_entries(params: { leaderboardName: string, includeUser?: boolean, quantityAround?: number, quantityTop?: number }, cb: CbLeaderboardList) {
        cb(false, null);
    }


    // ads

    _set_interstitial_state(state: INTERSTITIAL_STATE) {
        if (this._interstitialState === state && state !== INTERSTITIAL_STATE.FAILED) {
            return;
        }

        this._interstitialState = state;
        if (this.cb_interstitial_state)
            this.cb_interstitial_state(this._interstitialState);
    }

    _set_rewarded_state(state: REWARDED_STATE) {
        if (this._rewardedState === state && state !== REWARDED_STATE.FAILED) {
            return;
        }

        this._rewardedState = state;
        if (this.cb_rewarded_state)
            this.cb_rewarded_state(this._rewardedState);
    }

    _setBannerState(state: BANNER_STATE) {
        if (this._bannerState === state && state !== BANNER_STATE.FAILED) {
            return;
        }

        this._bannerState = state;
        if (this.cb_banner_state)
            this.cb_banner_state(this._bannerState);
    }

    show_banner(params?: any) {
    }

    hide_banner() {
    }

    show_interstitial() {
    }

    show_rewarded() {
    }

    is_lock_url(url: string, method: string) {
        return new Promise((resolve, reject) => {
            fetch(url, { method: method, mode: "no-cors", cache: "no-store" })
                .then(() => resolve(0))
                .catch(() => resolve(1));
        });
    }

    _check_ad_block() {
        return new Promise((resolve, reject) => {
            // Ad Guards, etc... 
            this.is_lock_url('https://ad.mail.ru', 'HEAD').then((result) => {
                if (result == 1)
                    resolve(1);
                else {
                    // uBlock origin
                    this.is_lock_url('https://top-fwz1.mail.ru/js/code.js', 'POST').then((result) => resolve(result));
                }
            });
        });
    }

    check_ad_block() {
        this._check_ad_block().then((result) => {
            this._has_ad_block = result as number == 1;
        });
    }

    has_ad_block() {
        return this._has_ad_block;
    }

    // bind events

    bind_visible_state(params: any, cb: CbVisibleState) {
        this.cb_visible_state = cb;
    }

    bind_interstitial_events(params: any, cb: CbInterstitialState) {
        this.cb_interstitial_state = cb;
    }

    bind_banner_events(params: any, cb: CbBannerState) {
        this.cb_banner_state = cb;
    }

    bind_rewarded_events(params: any, cb: CbRewardedState) {
        this.cb_rewarded_state = cb;
    }




}