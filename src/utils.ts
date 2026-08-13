export function addJavaScript(src: string) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.addEventListener('load', resolve);
        // без обработчика ошибки промис висел бы вечно и мост молча не поднимался
        script.addEventListener('error', () => reject(new Error('failed to load script: ' + src)));
        document.head.appendChild(script);
    });
}