import { BaseSdk } from "./BaseSdk";
import { BANNER_STATE, CbResultData, CbResultVal, INTERSTITIAL_STATE, REWARDED_STATE } from "./types";
import type { GamePush, GamePushPurchaseResult } from "./gamepush.d";

export class PikabuSdk extends BaseSdk {
    _platformId = 'pikabu';
    private _gp: GamePush | null = null;
    private _projectId: string;
    private _token: string;

    constructor(cb_ready: CbResultVal, projectId: string, token: string) {
        super(() => { });
        this._projectId = projectId;
        this._token = token;

        // Создаём уникальное имя callback для избежания конфликтов
        const callbackName = '__gpInit_' + String(Date.now());

        // Устанавливаем callback для инициализации GamePush
        (window as unknown as Record<string, unknown>)[callbackName] = async (gp: GamePush) => {
            this._gp = gp;
            this.log('GamePush SDK loaded');

            try {
                // Ожидаем готовности игрока
                await gp.player.ready;
                this.log('GamePush player ready');

                // Заполняем данные игрока
                this._playerId = String(gp.player.credentials || '');
                this._playerName = gp.player.name || '';
                this._playerPhotos = gp.player.avatar ? [gp.player.avatar] : [];
                this._isPlayerAuthorized = gp.player.isLoggedIn || false;

                this.log('Player data:', {
                    id: this._playerId,
                    name: this._playerName,
                    authorized: this._isPlayerAuthorized
                });

                // Устанавливаем поддержку баннеров
                this._isBannerSupported = gp.ads?.isStickyAvailable || false;

                // Загружаем данные из облачного хранилища
                this.load_all_data_from_storage(cb_ready);

            } catch (err) {
                this.error('GamePush init error:', err);
                cb_ready(false);
            }

            // Удаляем временный callback
            delete (window as unknown as Record<string, unknown>)[callbackName];
        };

        // Загружаем GamePush SDK
        const script = document.createElement('script');
        script.src = `https://gamepush.com/sdk/game-score.js?projectId=${this._projectId}&publicToken=${this._token}&callback=${callbackName}`;
        script.async = true;
        script.onerror = () => {
            this.error('Failed to load GamePush SDK');
            cb_ready(false);
        };
        document.head.appendChild(script);
    }

    // ==================== Storage ====================

    load_all_data_from_storage(cb: CbResultVal) {
        if (!this._gp) {
            this.error('GamePush not initialized');
            return cb(false);
        }

        try {
            // GamePush хранит данные в gp.player как поля
            // Получаем все данные игрока и кешируем их
            this._platformStorageCachedData = {};

            // GamePush использует предопределённые поля из панели управления
            // Для универсальности используем localStorage как fallback для произвольных ключей
            if (this._localStorage) {
                const keys = Object.keys(this._localStorage);
                for (const key of keys) {
                    try {
                        const value = this._localStorage.getItem(key);
                        this._platformStorageCachedData[key] = this.decode_storage_value(value);
                    } catch (e) {
                        // ignore
                    }
                }
            }

            cb(true);
        } catch (err) {
            this.error('load_all_data_from_storage error:', err);
            cb(false);
        }
    }

    get_data_from_storage(params: { key: string | string[] }, cb: CbResultData, use_cache = false) {
        if (!this._gp) {
            return super.get_data_from_storage(params, cb, use_cache);
        }

        // Сначала проверяем кеш
        if (use_cache && this._platformStorageCachedData) {
            const cached = this._get_cached_storage(params);
            if (cached[0]) {
                return cb(true, cached[1]);
            }
        }

        // Используем gp.player.get для получения данных
        try {
            if (Array.isArray(params.key)) {
                const values = params.key.map(k => {
                    const gpValue = this._gp.player.get(k);
                    if (gpValue !== undefined && gpValue !== null) {
                        return gpValue;
                    }
                    // Fallback на localStorage
                    if (this._localStorage) {
                        const localValue = this._localStorage.getItem(k);
                        return this.decode_storage_value(localValue);
                    }
                    return null;
                });
                return cb(true, values);
            }

            const gpValue = this._gp.player.get(params.key);
            if (gpValue !== undefined && gpValue !== null) {
                return cb(true, gpValue);
            }

            // Fallback на localStorage
            if (this._localStorage) {
                const localValue = this._localStorage.getItem(params.key);
                return cb(true, this.decode_storage_value(localValue));
            }

            return cb(true, null);
        } catch (err) {
            this.error('get_data_from_storage error:', err);
            return cb(false, null);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set_data_to_storage(params: { key: string | string[], value: any }, cb: CbResultVal) {
        if (!this._gp) {
            return super.set_data_to_storage(params, cb);
        }

        try {
            if (Array.isArray(params.key)) {
                for (let i = 0; i < params.key.length; i++) {
                    const key = params.key[i];
                    const value = params.value[i];
                    this._gp.player.set(key, value);

                    // Также сохраняем в localStorage как backup
                    if (this._localStorage) {
                        this._localStorage.setItem(key, this.encode_storage_value(value));
                    }

                    // Обновляем кеш
                    if (this._platformStorageCachedData) {
                        this._platformStorageCachedData[key] = value;
                    }
                }
            } else {
                this._gp.player.set(params.key, params.value);

                // Также сохраняем в localStorage как backup
                if (this._localStorage) {
                    this._localStorage.setItem(params.key, this.encode_storage_value(params.value));
                }

                // Обновляем кеш
                if (this._platformStorageCachedData) {
                    this._platformStorageCachedData[params.key] = params.value;
                }
            }

            // Синхронизируем с облаком
            this._gp.player.sync().then(() => {
                this.log('Data synced to cloud');
                cb(true);
            }).catch((err: Error) => {
                this.error('Sync error:', err);
                // Даже если синхронизация не удалась, данные сохранены локально
                cb(true);
            });

        } catch (err) {
            this.error('set_data_to_storage error:', err);
            cb(false);
        }
    }

    delete_data_from_storage(params: { key: string | string[] }, cb: CbResultVal) {
        if (!this._gp) {
            return super.delete_data_from_storage(params, cb);
        }

        try {
            if (Array.isArray(params.key)) {
                for (const key of params.key) {
                    this._gp.player.set(key, null);
                    if (this._localStorage) {
                        this._localStorage.removeItem(key);
                    }
                    if (this._platformStorageCachedData) {
                        delete this._platformStorageCachedData[key];
                    }
                }
            } else {
                this._gp.player.set(params.key, null);
                if (this._localStorage) {
                    this._localStorage.removeItem(params.key);
                }
                if (this._platformStorageCachedData) {
                    delete this._platformStorageCachedData[params.key];
                }
            }

            // Синхронизируем с облаком
            this._gp.player.sync().then(() => {
                cb(true);
            }).catch(() => {
                cb(true); // Локально удалено
            });

        } catch (err) {
            this.error('delete_data_from_storage error:', err);
            cb(false);
        }
    }

    // ==================== Ads ====================

    show_interstitial() {
        if (!this._gp || !this._gp.ads) {
            this.warn('GamePush ads not available');
            this._set_interstitial_state(INTERSTITIAL_STATE.FAILED);
            return;
        }

        if (!this._gp.ads.isFullscreenAvailable) {
            this.warn('Fullscreen ads not available');
            this._set_interstitial_state(INTERSTITIAL_STATE.FAILED);
            return;
        }

        this._set_interstitial_state(INTERSTITIAL_STATE.LOADING);

        this._gp.ads.showFullscreen()
            .then((result: boolean) => {
                this.log('Interstitial result:', result);
                this._set_interstitial_state(INTERSTITIAL_STATE.CLOSED);
            })
            .catch((err: Error) => {
                this.error('Interstitial error:', err);
                this._set_interstitial_state(INTERSTITIAL_STATE.FAILED);
            });
    }

    show_rewarded() {
        if (!this._gp || !this._gp.ads) {
            this.warn('GamePush ads not available');
            this._set_rewarded_state(REWARDED_STATE.FAILED);
            return;
        }

        if (!this._gp.ads.isRewardedAvailable) {
            this.warn('Rewarded ads not available');
            this._set_rewarded_state(REWARDED_STATE.FAILED);
            return;
        }

        this._set_rewarded_state(REWARDED_STATE.LOADING);

        this._gp.ads.showRewardedVideo()
            .then((success: boolean) => {
                this.log('Rewarded result:', success);
                if (success) {
                    this._set_rewarded_state(REWARDED_STATE.REWARDED);
                }
                this._set_rewarded_state(REWARDED_STATE.CLOSED);
            })
            .catch((err: Error) => {
                this.error('Rewarded error:', err);
                this._set_rewarded_state(REWARDED_STATE.FAILED);
            });
    }

    show_banner() {
        if (!this._gp || !this._gp.ads) {
            this.warn('GamePush ads not available');
            this._setBannerState(BANNER_STATE.FAILED);
            return;
        }

        if (!this._gp.ads.isStickyAvailable) {
            this.warn('Sticky banner not available');
            this._setBannerState(BANNER_STATE.FAILED);
            return;
        }

        this._setBannerState(BANNER_STATE.LOADING);

        try {
            this._gp.ads.showSticky();
            this._isBannerSupported = true;
            this._setBannerState(BANNER_STATE.SHOWN);
        } catch (err) {
            this.error('Banner error:', err);
            this._setBannerState(BANNER_STATE.FAILED);
        }
    }

    hide_banner() {
        if (!this._gp || !this._gp.ads) {
            return;
        }

        try {
            this._gp.ads.closeSticky();
            this._setBannerState(BANNER_STATE.HIDDEN);
        } catch (err) {
            this.error('Hide banner error:', err);
        }
    }

    has_ad_block() {
        if (!this._gp || !this._gp.ads) {
            return false;
        }
        return this._gp.ads.isAdblockEnabled || false;
    }

    // ==================== Purchases ====================

    init_purchases(params: unknown, cb: CbResultData) {
        if (!this._gp || !this._gp.payments) {
            this.warn('GamePush payments not available');
            return cb(false, null);
        }

        if (!this._gp.payments.isAvailable) {
            this.warn('Payments not available on this platform');
            return cb(false, null);
        }

        this._gp.payments.fetchProducts()
            .then(() => {
                this.log('Products fetched:', this._gp.payments.products);
                cb(true, this._gp.payments.products);
            })
            .catch((err: Error) => {
                this.error('init_purchases error:', err);
                cb(false, null);
            });
    }

    get_catalog(params: unknown, cb: CbResultData) {
        if (!this._gp || !this._gp.payments) {
            return cb(false, null);
        }

        cb(true, this._gp.payments.products || []);
    }

    get_purchases(params: unknown, cb: CbResultData) {
        if (!this._gp || !this._gp.payments) {
            return cb(false, null);
        }

        cb(true, this._gp.payments.purchases || []);
    }

    purchase(params: { id?: number, tag?: string }, cb: CbResultData) {
        if (!this._gp || !this._gp.payments) {
            this.warn('GamePush payments not available');
            return cb(false, null);
        }

        if (!this._gp.payments.isAvailable) {
            this.warn('Payments not available on this platform');
            return cb(false, null);
        }

        const purchaseParams: { id?: number; tag?: string } = {};
        if (params.id !== undefined) {
            purchaseParams.id = params.id;
        }
        if (params.tag !== undefined) {
            purchaseParams.tag = params.tag;
        }

        this._gp.payments.purchase(purchaseParams)
            .then((result: GamePushPurchaseResult) => {
                this.log('Purchase success:', result);
                cb(true, result);
            })
            .catch((err: Error) => {
                this.error('Purchase error:', err);
                cb(false, err);
            });
    }

    consume_purchase(params: { id?: number, tag?: string, token?: string }, cb: CbResultData) {
        if (!this._gp || !this._gp.payments) {
            this.warn('GamePush payments not available');
            return cb(false, null);
        }

        const consumeParams: { id?: number; tag?: string } = {};
        if (params.id !== undefined) {
            consumeParams.id = params.id;
        }
        if (params.tag !== undefined) {
            consumeParams.tag = params.tag;
        }

        this._gp.payments.consume(consumeParams)
            .then((result: GamePushPurchaseResult) => {
                this.log('Consume success:', result);
                cb(true, result);
            })
            .catch((err: Error) => {
                this.error('Consume error:', err);
                cb(false, err);
            });
    }

    // ==================== Other ====================

    game_ready() {
        // GamePush автоматически отслеживает готовность игры
        this.log('Game ready');
    }
}
