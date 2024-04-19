export function addJavaScript(src: string) {
    return new Promise(resolve => {
        const script = document.createElement('script');
        script.src = src;
        script.addEventListener('load', resolve);
        document.head.appendChild(script);
    });
}