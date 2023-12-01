import { CbResultVal } from "./types";
import { BaseSdk } from "./BaseSdk";
import { YandexSdk } from "./yandex";
import { OkSdk } from "./ok";
import { VkSdk } from "./vk";

(window as any).init_sdk_platform = function (params: any, cb: CbResultVal) {
    console.log('start init sdk');
    let sdk: any;

    function do_ready() {
        const t = setInterval(() => {
            if (sdk) {
                clearInterval(t);
                (window as any).sdk = sdk;
                console.log('end init sdk');
                cb(true);
                return;
            }
        }, 10);
    }


    const url = new URL(window.location.href)
    if (url.hostname.includes('yandex') || url.hash.includes('yandex'))
        sdk = new YandexSdk(do_ready);
    else if (url.searchParams.has('api_id') && url.searchParams.has('viewer_id') && url.searchParams.has('auth_key'))
        sdk = new VkSdk(do_ready);
    else if (url.searchParams.has('web_server') && url.searchParams.has('application_key') && url.searchParams.has('api_server'))
        sdk = new OkSdk(do_ready);
    else
        sdk = new BaseSdk(do_ready);

}
