/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CbResultVal } from "./types";
import { BaseSdk } from "./BaseSdk";
import { YandexSdk } from "./yandex";
import { OkSdk } from "./ok";
import { VkSdk } from "./vk";
import { GamePushSdk } from "./gamepush-sdk";
import { bind_errors } from "./errorsHandler";
//bind_errors();

// патчим прототипы ВСЕХ SDK — гарантируем lowercase из get_language,
// независимо от того, как defjs резолвит метод (через экземпляр или прототип)
for (const SdkClass of [BaseSdk, VkSdk, YandexSdk, OkSdk, GamePushSdk] as any[]) {
    const orig = SdkClass.prototype.get_language;
    if (orig) {
        SdkClass.prototype.get_language = function () {
            return (orig.call(this) || 'ru').toLowerCase();
        };
    }
}

(window as any).init_sdk_platform = function (params: any, cb: CbResultVal) {
    console.log('start init sdk');
    let sdk: any;

    function do_ready() {
        const t = setInterval(() => {
            if (sdk) {
                clearInterval(t);
                // нормализуем ?lang в URL в lowercase до того, как Lua прочитает
                // (Ads.lua:252 читает ?lang напрямую через html5.run, минуя мост)
                try {
                    const u = new URL(window.location.href);
                    const lang_param = u.searchParams.get('lang');
                    if (lang_param && lang_param !== lang_param.toLowerCase()) {
                        u.searchParams.set('lang', lang_param.toLowerCase());
                        window.history.replaceState(null, '', u.toString());
                    }
                } catch (_) { /* ignore */ }
                (window as any).sdk = sdk;
                console.log('end init sdk, lang:', sdk.get_language());
                cb(true);
                return;
            }
        }, 10);
    }


    const url = new URL(window.location.href);
    if (url.hostname.includes('yandex') || url.hash.includes('yandex'))
        sdk = new YandexSdk(do_ready);
    else if (
        (url.searchParams.has('api_id') && url.searchParams.has('viewer_id') && url.searchParams.has('auth_key')) ||
        (url.searchParams.has('vk_app_id')) ||
        (window as any).vkBridge // мобильный VK может не передавать параметры в URL
    )
        sdk = new VkSdk(do_ready);
    else if (url.searchParams.has('web_server') && url.searchParams.has('application_key') && url.searchParams.has('api_server'))
        sdk = new OkSdk(do_ready);
    else if (params.projectId && params.token)
        sdk = new GamePushSdk(do_ready, params.projectId, params.token);
    else
        sdk = new BaseSdk(do_ready, true);

};
