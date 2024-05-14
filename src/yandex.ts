import { YandexGames } from "CreexTeamYaSDK";
import { addJavaScript } from "./utils";
import { CbLeaderboardList, CbResultData, CbResultVal, INTERSTITIAL_STATE, REWARDED_STATE } from "./types";
import { BaseSdk } from "./BaseSdk";

const SDK_URL = 'https://yandex.ru/games/sdk/v2';

export class YandexSdk extends BaseSdk {
    _platformId = 'yandex';
    private _leaderboards: YandexGames.Leaderboards;
    private _platformSdk: YandexGames.SDK;
    private _yandexPlayer: YandexGames.Player;
    private _yandex_payments: YandexGames.Payments;


    constructor(cb_ready: CbResultVal) {
        super(() => { });
        addJavaScript(SDK_URL)
            .then(() => {
                YaGames.init()
                    .then(sdk => {
                        this._platformSdk = sdk;

                        const getPlayerPromise = new Promise((resolve, reject) => {
                            this.get_player({}, resolve);
                        });

                        const getLeaderboardsPromise = this._platformSdk.getLeaderboards()
                            .then(lb => this._leaderboards = lb);

                        const getSafeStoragePromiseWithFallback = new Promise((resolve, reject) => {
                            const id_timer = setTimeout(() => {
                                this.warn('getSafeStoragePromise fallback');
                                resolve(false);
                            }, 5000);

                            this._platformSdk.getStorage()
                                .then((safeStorage) => {
                                    this._localStorage = safeStorage;
                                    clearTimeout(id_timer);
                                    resolve(true);
                                });
                        });

                        Promise.all([getPlayerPromise, getLeaderboardsPromise, getSafeStoragePromiseWithFallback])
                            .finally(() => {
                                // todo хранилище доступно даже если не авторизован ^_^ 
                                this.load_all_data_from_storage(cb_ready);
                            });
                    });
            });
    }

    get_platform_tld() {
        if (this._platformSdk)
            return this._platformSdk.environment.i18n.tld.toLowerCase();
        return super.get_platform_tld();
    }

    get_language() {
        if (this._platformSdk)
            return this._platformSdk.environment.i18n.lang.toLowerCase();
        return super.get_language();
    }

    get_player(options: any, cb: CbResultVal) {
        const parameters = {
            scopes: false
        };

        if (options && typeof options.scopes === 'boolean')
            parameters.scopes = options.scopes;


        this._platformSdk.getPlayer(parameters)
            .then(player => {
                this._playerId = player.getUniqueID();
                this._isPlayerAuthorized = player.getMode() !== 'lite';

                const name = player.getName();
                if (name !== '')
                    this._playerName = name;


                this._playerPhotos = [];
                const photoSmall = player.getPhoto('small');
                const photoMedium = player.getPhoto('medium');
                const photoLarge = player.getPhoto('large');

                if (photoSmall)
                    this._playerPhotos.push(photoSmall);
                if (photoMedium)
                    this._playerPhotos.push(photoMedium);
                if (photoLarge)
                    this._playerPhotos.push(photoLarge);
                this._yandexPlayer = player;
            })
            .finally(() => cb(true));
    }

    authorize_player(options: any, cb: CbResultVal) {
        if (this._isPlayerAuthorized) {
            this.get_player(options, cb);
        } else {
            this._platformSdk.auth.openAuthDialog()
                .then(() => {
                    this.get_player(options, cb);
                })
                .catch(error => {
                    this.error(error);
                    cb(false);
                });
        }
    }

    load_all_data_from_storage(cb: CbResultVal) {
        this._platformStorageCachedData = {};
        if (this._yandexPlayer) {
            this._yandexPlayer.getData()
                .then(data => {
                    this._platformStorageCachedData = data;
                    cb(true);
                })
                .catch(error => {
                    this.error(error);
                    cb(false);
                });
        }
        else
            cb(false);
    }

    get_data_from_storage(params: { key: string | string[] }, cb: CbResultData, use_cache = false) {
        if (use_cache) {
            const tmp = this._get_cached_storage(params);
            if (tmp[0] === true) {
                return cb(true, tmp[1]);
            }
        }

        if (this._yandexPlayer) {
            this._yandexPlayer.getData()
                .then(data => {
                    this._platformStorageCachedData = data;
                    if (Array.isArray(params.key)) {
                        const values = [];
                        for (let i = 0; i < params.key.length; i++) {
                            const value = typeof this._platformStorageCachedData[params.key[i]] === 'undefined' ? null : this._platformStorageCachedData[params.key[i]];
                            values.push(value);
                        }
                        return cb(true, values);
                    }
                    return cb(true, typeof this._platformStorageCachedData[params.key] === 'undefined' ? null : this._platformStorageCachedData[params.key]);
                })
                .catch(error => {
                    this.error(error);
                    cb(false, null);
                });
        } else {
            super.get_data_from_storage(params, cb, use_cache);
        }

    }

    set_data_to_storage(params: { key: string | string[], value: any }, cb: CbResultVal) {
        if (this._yandexPlayer) {
            const data = this._platformStorageCachedData !== null ? { ...this._platformStorageCachedData } : {};
            if (Array.isArray(params.key)) {
                for (let i = 0; i < params.key.length; i++) {
                    data[params.key[i]] = params.value[i];
                    if (this._platformStorageCachedData != null)
                        this._platformStorageCachedData[params.key[i]] = params.value[i];
                }
            } else {
                data[params.key] = params.value;
                if (this._platformStorageCachedData != null)
                    this._platformStorageCachedData[params.key] = params.value;
            }

            this._yandexPlayer.setData(data)
                .then(() => {
                    this._platformStorageCachedData = data;
                    cb(true);
                })
                .catch(error => {
                    this.error(error);
                    cb(false);
                });
        } else {
            // для неавторизованного, но у которого возможно есть safeStorage
            super.set_data_to_storage(params, cb);
        }
    }

    delete_data_from_storage(params: { key: string }, cb: CbResultVal) {
        if (this._yandexPlayer) {
            const data = this._platformStorageCachedData !== null ? { ...this._platformStorageCachedData } : {};
            if (Array.isArray(params.key)) {
                for (let i = 0; i < params.key.length; i++)
                    delete data[params.key[i]];
            }
            else
                delete data[params.key];

            this._yandexPlayer.setData(data)
                .then(() => {
                    this._platformStorageCachedData = data;
                    cb(true);
                })
                .catch(error => {
                    this.error(error);
                    cb(false);
                });
        } else {
            super.delete_data_from_storage(params, cb);
        }
    }

    rate(data: any, cb: CbResultVal) {
        this._platformSdk.feedback.canReview()
            .then(result => {
                if (result.value) {
                    this._platformSdk.feedback.requestReview()
                        .then(({ feedbackSent }) => {
                            if (feedbackSent) {
                                cb(true);
                                return;
                            }
                            cb(false);
                        })
                        .catch(error => {
                            this.error(error);
                            cb(false);
                        });
                    return;
                }
                this.error(result.reason);
                cb(false);
            })
            .catch(error => {
                this.error(error);
                cb(false);
            });
    }

    set_leaderboard_score(params: { leaderboardName: string, score: number, extraData?: any }, cb: CbResultVal) {
        if (!this._isPlayerAuthorized) {
            this.error('Player is not authorized');
            return cb(false);
        }

        if (!this._leaderboards || !params || !params.score || !params.leaderboardName) {
            return cb(false);
        }

        if (typeof params.score === 'string')
            params.score = parseInt(params.score);


        this._leaderboards.setLeaderboardScore(params.leaderboardName, params.score, params.extraData)
            .then(() => {
                cb(true);
            })
            .catch(error => {
                this.error(error);
                cb(false);
            });
    }

    get_leaderboard_score(params: { leaderboardName: string }, cb: CbResultData) {
        if (!this._isPlayerAuthorized) {
            return cb(false);
        }

        if (!this._leaderboards || !params || !params.leaderboardName) {
            return cb(false);
        }


        this._leaderboards.getLeaderboardPlayerEntry(params.leaderboardName)
            .then(result => {
                cb(true, result.score);
            })
            .catch(error => {
                this.error(error);
                cb(false);
            });
    }

    get_leaderboard_entries(params: { leaderboardName: string, includeUser?: boolean, quantityAround?: number, quantityTop?: number }, cb: CbLeaderboardList) {
        if (!this._leaderboards || !params || !params.leaderboardName)
            return cb(false, []);

        const parameters = {
            includeUser: false,
            quantityAround: 5,
            quantityTop: 5
        };
        if (typeof params.includeUser === 'boolean')
            parameters.includeUser = params.includeUser;
        if (typeof params.quantityAround === 'string')
            params.quantityAround = parseInt(params.quantityAround);
        if (typeof params.quantityAround === 'number')
            parameters.quantityAround = params.quantityAround;
        if (typeof params.quantityTop === 'string')
            params.quantityTop = parseInt(params.quantityTop);
        if (typeof params.quantityTop === 'number')
            parameters.quantityTop = params.quantityTop;

        this._leaderboards.getLeaderboardEntries(params.leaderboardName, parameters)
            .then(result => {
                let entries = null;

                if (result && result.entries.length > 0) {
                    entries = result.entries.map(e => {
                        const photos = [];
                        const photoSmall = e.player.getAvatarSrc('small');
                        let extraData = '';
                        const isUser = e.rank == result.userRank;
                        if (e.extraData != undefined)
                            extraData = e.extraData;

                        if (photoSmall)
                            photos.push(photoSmall);

                        return {
                            id: e.player.uniqueID,
                            score: e.score,
                            rank: e.rank,
                            name: e.player.publicName,
                            photos,
                            extraData,
                            isUser
                        };
                    });
                }

                cb(true, entries);
            })
            .catch(error => {
                this.error(error);
                cb(false, []);
            });

    }

    show_interstitial() {
        this._platformSdk.adv.showFullscreenAdv({
            callbacks: {
                onOpen: () => {
                    this._set_interstitial_state(INTERSTITIAL_STATE.OPENED);
                },
                onClose: wasShown => {
                    if (wasShown) {
                        this._set_interstitial_state(INTERSTITIAL_STATE.CLOSED);
                    } else {
                        this._set_interstitial_state(INTERSTITIAL_STATE.FAILED);
                    }
                }
            }
        });
    }

    show_rewarded() {
        this._platformSdk.adv.showRewardedVideo({
            callbacks: {
                onOpen: () => {
                    this._set_rewarded_state(REWARDED_STATE.OPENED);
                },
                onRewarded: () => {
                    this._set_rewarded_state(REWARDED_STATE.REWARDED);
                },
                onClose: () => {
                    this._set_rewarded_state(REWARDED_STATE.CLOSED);
                },
                onError: error => {
                    this._set_rewarded_state(REWARDED_STATE.FAILED);
                }
            }
        });
    }

    init_purchases(params: any, cb: CbResultData) {
        this._platformSdk.getPayments({ signed: true }).then(_payments => {
            this._yandex_payments = _payments;
            this.get_catalog({}, cb);
        }).catch(err => {
            this.error('init_purchases', err);
            cb(false);
        });
    }

    get_catalog(params: any, cb: CbResultData) {
        if (!this._yandex_payments)
            return cb(false, null);
        this._yandex_payments.getCatalog().then(_catalog => {
            cb(true, _catalog);
        }).catch(err => {
            this.error('get_catalog', err);
            cb(false);
        });
    }

    get_purchases(params: any, cb: CbResultData) {
        if (!this._yandex_payments)
            return cb(false, null);
        this._yandex_payments.getPurchases().then(_purchases => {
            cb(true, _purchases);
        }).catch(err => {
            this.error('get_purchases', err);
            cb(false);
        });

    }

    purchase(params: { id: string, developerPayload?: string }, cb: CbResultData) {
        if (!this._yandex_payments)
            return cb(false, null);
        this._yandex_payments.purchase({ id: params.id, developerPayload: params.developerPayload }).then(_purchase => {
            cb(true, _purchase);
        }).catch(err => {
            this.error('purchase', err);
            cb(false);
        });
    }

    consume_purchase(params: { token: string }, cb: CbResultData) {
        if (!this._yandex_payments)
            return cb(false);
        this._yandex_payments.consumePurchase(params.token).then(_purchase => {
            cb(true, _purchase);
        }).catch(err => {
            this.error('consume_purchase', err);
            cb(false);
        });
    }




}