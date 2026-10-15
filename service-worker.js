
const CACHE_NAME = "meu-spotify-v2";

const ARQUIVOS = [
    "./",
    "./index.html",
    "./style.css",
    "./arquivo.js",
    "./manifest.json",
    "./icone.svg",
    "./player.svg",
    "./jsmediatags.min.js"
];

// Instala o service worker e guarda os arquivos essenciais.
self.addEventListener("install", (evento) => {
    evento.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ARQUIVOS))
            .then(() => self.skipWaiting())
    );
});

// Ativa a versão nova e remove caches antigos deste aplicativo.
self.addEventListener("activate", (evento) => {
    evento.waitUntil(
        caches.keys().then((nomes) =>
            Promise.all(
                nomes
                    .filter((nome) =>
                        nome.startsWith("meu-spotify-") &&
                        nome !== CACHE_NAME
                    )
                    .map((nome) => caches.delete(nome))
            )
        ).then(() => self.clients.claim())
    );
});

// Primeiro tenta a rede; se estiver offline, usa o cache.
self.addEventListener("fetch", (evento) => {
    const requisicao = evento.request;

    if (
        requisicao.method !== "GET" ||
        new URL(requisicao.url).origin !== self.location.origin
    ) {
        return;
    }

    evento.respondWith(
        fetch(requisicao)
            .then((resposta) => {
                if (resposta.ok) {
                    const copia = resposta.clone();

                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(requisicao, copia);
                    });
                }

                return resposta;
            })
            .catch(async () => {
                const guardado = await caches.match(requisicao);

                if (guardado) return guardado;

                if (requisicao.mode === "navigate") {
                    return caches.match("./index.html");
                }

                return new Response("Recurso indisponível offline.", {
                    status: 503,
                    headers: { "Content-Type": "text/plain; charset=utf-8" }
                });
            })
    );
});
