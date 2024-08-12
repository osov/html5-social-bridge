/* eslint-disable prefer-rest-params */
import { fill } from "./error_utils";

const orig_console = console.log;
function trigger_handlers(type: string, data: any) {
    orig_console('trigger_handlers:', type,);
    orig_console('trigger_handlers-data:', data);

    const response = fetch('https://zanzar.ru/vk_test/caller.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: JSON.stringify({ type, data })
    });
}

export const CONSOLE_LEVELS = ['debug', 'info', 'warn', 'error', 'log', 'assert', 'trace'] as const;
export const originalConsoleMethods: { [key in string]?: (...args: any[]) => void; } = {};

function bind_console() {
    if (!('console' in window))
        return;

    CONSOLE_LEVELS.forEach(function (level) {
        if (!(level in window.console)) {
            return;
        }

        fill(window.console, level, function (originalConsoleMethod: () => any) {
            originalConsoleMethods[level] = originalConsoleMethod;

            return function (...args: any[]): void {
                const handlerData = { args, level };
                trigger_handlers('console', handlerData);

                const log = originalConsoleMethods[level];
                log && log.apply(window.console, args);
            };
        });
    });
}

let _oldOnErrorHandler: any = null;
function bind_on_error() {
    _oldOnErrorHandler = window.onerror;

    window.onerror = function (msg: string | object, url?: string, line?: number, column?: number, error?: Error,): boolean {
        const handlerData = { column, error, line, msg, url, };
        trigger_handlers('error', handlerData);
        //if (_oldOnErrorHandler)
        //    return _oldOnErrorHandler.apply(this, arguments);
        return false;
    };
}

let _oldOnUnhandledRejectionHandler = null;
function bind_unhandled_rejection(): void {
    _oldOnUnhandledRejectionHandler = window.onunhandledrejection;

    window.onunhandledrejection = function (e: any): boolean {
        const handlerData = e;
        trigger_handlers('unhandledrejection', handlerData);
        //if (_oldOnUnhandledRejectionHandler) 
        //  return _oldOnUnhandledRejectionHandler.apply(this, arguments);
        return true;
    };

}

// todo add https://github.com/getsentry/sentry-javascript/blob/master/packages/utils/src/instrument/fetch.ts


export function bind_errors() {
    bind_console();
    bind_on_error();
    bind_unhandled_rejection();
}
