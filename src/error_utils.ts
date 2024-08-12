export function fill(source: { [key: string]: any }, name: string, replacementFactory: (...args: any[]) => any): void {
    if (!(name in source)) {
        return;
    }

    const original = source[name] as () => any;
    const wrapped = replacementFactory(original);

    // Make sure it's a function first, as we need to attach an empty prototype for `defineProperties` to work
    // otherwise it'll throw "TypeError: Object.defineProperties called on non-object"
    if (typeof wrapped === 'function') {
        markFunctionWrapped(wrapped, original);
    }

    source[name] = wrapped;
}

export function markFunctionWrapped(wrapped: any, original: any): void {
    try {
        const proto = original.prototype || {};
        wrapped.prototype = original.prototype = proto;
        addNonEnumerableProperty(wrapped, '__fnc_original__', original);
    } catch (o_O) { }
}

export function addNonEnumerableProperty(obj: object, name: string, value: unknown): void {
    try {
        Object.defineProperty(obj, name, {
            // enumerable: false, // the default, so we can save on bundle size by not explicitly setting it
            value: value,
            writable: true,
            configurable: true,
        });
    } catch (o_O) {
        console.log(`Failed to add non-enumerable property "${name}" to object`, obj);
    }
}
