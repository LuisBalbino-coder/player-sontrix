
const seletor = document.getElementById("seletor-musicas");
const seletorCapa = document.getElementById("seletor-capa");
const botaoImportar = document.getElementById("importar");
const listaMusicas = document.getElementById("lista-musicas");

const botaoPlay = document.getElementById("play");
const botaoAnterior = document.getElementById("anterior");
const botaoProxima = document.getElementById("proxima");

const tituloAtual = document.getElementById("titulo-atual");
const artistaAtual = document.getElementById("artista-atual");
const capaAtual = document.querySelector(".cover");

const progresso = document.getElementById("progresso");
const tempoAtual = document.getElementById("tempo-atual");
const duracao = document.getElementById("duracao");
const controleVolume = document.getElementById("volume");
const busca = document.getElementById("busca");

const audio = new Audio();

let musicas = [];
let musicaAtual = -1;
let musicaSelecionadaParaCapa = null;

// Banco de dados local.
function abrirBanco() {
    return new Promise((resolve, reject) => {
        const requisicao = indexedDB.open("MeuSpotifyDB", 1);

        requisicao.onupgradeneeded = () => {
            const banco = requisicao.result;

            if (!banco.objectStoreNames.contains("musicas")) {
                banco.createObjectStore("musicas", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);
    });
}

const bancoPronto = abrirBanco();

// Lê uma capa que já esteja incorporada ao áudio.
function lerCapa(arquivo) {
    return new Promise((resolve) => {
        if (!window.jsmediatags) {
            resolve(null);
            return;
        }

        window.jsmediatags.read(arquivo, {
            onSuccess: (resultado) => {
                const imagem = resultado.tags.picture;

                if (!imagem || !imagem.data) {
                    resolve(null);
                    return;
                }

                const blob = new Blob(
                    [new Uint8Array(imagem.data)],
                    { type: imagem.format || "image/jpeg" }
                );

                resolve(blob);
            },

            onError: () => resolve(null)
        });
    });
}

// Salva uma música e sua capa.
async function salvarArquivo(arquivo, capa) {
    const banco = await bancoPronto;

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction("musicas", "readwrite");
        const armazenamento = transacao.objectStore("musicas");

        const requisicao = armazenamento.add({
            nome: arquivo.name.replace(/\.[^/.]+$/, ""),
            arquivo,
            tipo: arquivo.type,
            capa: capa || null
        });

        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);
    });
}

// Atualiza a capa de uma música já salva, sem duplicá-la.
async function salvarCapaNoBanco(id, capa) {
    const banco = await bancoPronto;

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction("musicas", "readwrite");
        const armazenamento = transacao.objectStore("musicas");
        const requisicao = armazenamento.get(id);

        requisicao.onsuccess = () => {
            const registro = requisicao.result;

            if (!registro) {
                reject(new Error("Música não encontrada no banco."));
                return;
            }

            registro.capa = capa;

            const atualizacao = armazenamento.put(registro);

            atualizacao.onsuccess = () => resolve();
            atualizacao.onerror = () => reject(atualizacao.error);
        };

        requisicao.onerror = () => reject(requisicao.error);
    });
}


/* Remove somente o registro do Sontrix no IndexedDB. */
async function removerDoBanco(id) {
    const banco = await bancoPronto;

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction("musicas", "readwrite");
        const armazenamento = transacao.objectStore("musicas");

        armazenamento.delete(id);

        transacao.oncomplete = () => resolve();
        transacao.onerror = () => reject(transacao.error);
        transacao.onabort = () => {
            reject(transacao.error || new Error("Remoção cancelada."));
        };
    });
}

/* Remove uma música da biblioteca sem apagar o arquivo original. */
async function removerMusica(musica) {
    const confirmar = window.confirm(
        `Deseja remover "${musica.nome}" da biblioteca do Sontrix?\n\n` +
        "O arquivo original do seu computador não será apagado."
    );

    if (!confirmar) return;

    try {
        const indice = musicas.findIndex(
            (item) => item.id === musica.id
        );

        if (indice === -1) return;

        // Primeiro remove do banco. Se falhar, preserva a lista atual.
        await removerDoBanco(musica.id);

        // Se a música removida estiver tocando, para o player.
        if (musicas[musicaAtual]?.id === musica.id) {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();

            musicaAtual = -1;
            botaoPlay.textContent = "▶";
            tituloAtual.textContent = "Nenhuma música";
            artistaAtual.textContent = "Escolha uma faixa";

            capaAtual.style.backgroundImage = "none";
            capaAtual.textContent = "♫";

            progresso.value = 0;
            tempoAtual.textContent = "0:00";
            duracao.textContent = "0:00";
        } else if (musicaAtual > indice) {
            // Corrige o índice se uma faixa anterior for removida.
            musicaAtual--;
        }

        // Libera as URLs temporárias usadas pela interface.
        URL.revokeObjectURL(musica.url);

        if (musica.capaURL) {
            URL.revokeObjectURL(musica.capaURL);
        }

        // Remove somente essa faixa da lista em memória.
        musicas.splice(indice, 1);

        if (musicaSelecionadaParaCapa === musica.id) {
            musicaSelecionadaParaCapa = null;
        }

        renderizarMusicas();
    } catch (erro) {
        console.error("Erro ao remover música:", erro);
        alert("Não foi possível remover a música. Tente novamente.");
    }
}


// Recupera a biblioteca salva.
async function carregarBiblioteca() {
    try {
        const banco = await bancoPronto;

        const registros = await new Promise((resolve, reject) => {
            const transacao = banco.transaction("musicas", "readonly");
            const requisicao = transacao.objectStore("musicas").getAll();

            requisicao.onsuccess = () => resolve(requisicao.result);
            requisicao.onerror = () => reject(requisicao.error);
        });

        musicas = registros.map((registro) => ({
            id: registro.id,
            nome: registro.nome,
            arquivo: registro.arquivo,
            capa: registro.capa || null,
            url: URL.createObjectURL(registro.arquivo),
            capaURL: registro.capa
                ? URL.createObjectURL(registro.capa)
                : null
        }));

        renderizarMusicas();
    } catch (erro) {
        console.error("Erro ao carregar a biblioteca:", erro);
        listaMusicas.textContent =
            "Não foi possível carregar a biblioteca salva.";
    }
}

// Abre o seletor de músicas.
botaoImportar.addEventListener("click", () => {
    seletor.click();
});

// Importa e salva os arquivos de áudio.
seletor.addEventListener("change", async () => {
    const arquivos = Array.from(seletor.files);

    if (arquivos.length === 0) return;

    botaoImportar.disabled = true;
    botaoImportar.textContent = "Importando...";

    try {
        for (const arquivo of arquivos) {
            if (!arquivo.type.startsWith("audio/")) continue;

            // No Android, evitar ler a capa incorporada ao áudio para reduzir o pico de memória.
            // O arquivo original continua sendo salvo normalmente no IndexedDB.
            const dispositivoMovel = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            const capa = dispositivoMovel ? null : await lerCapa(arquivo);
            const id = await salvarArquivo(arquivo, capa);

            musicas.push({
                id,
                nome: arquivo.name.replace(/\.[^/.]+$/, ""),
                arquivo,
                capa,
                url: URL.createObjectURL(arquivo),
                capaURL: capa ? URL.createObjectURL(capa) : null
            });
        }

        renderizarMusicas();
    } catch (erro) {
        console.error("Erro ao salvar música:", erro);

        alert(
            "Não foi possível salvar as músicas. " +
            "Verifique o espaço disponível no navegador."
        );
    } finally {
        botaoImportar.disabled = false;
        botaoImportar.textContent = "＋ Adicionar músicas";
        seletor.value = "";
    }
});

// Abre o seletor de imagem para uma música específica.
function escolherCapa(musica) {
    musicaSelecionadaParaCapa = musica.id;
    seletorCapa.value = "";
    seletorCapa.click();
}

// Lê e salva a imagem escolhida pelo usuário.
seletorCapa.addEventListener("change", async () => {
    const imagem = seletorCapa.files[0];
    const id = musicaSelecionadaParaCapa;

    if (!imagem || id === null) return;

    if (!imagem.type.startsWith("image/")) {
        alert("Selecione um arquivo de imagem válido.");
        return;
    }

    const musica = musicas.find((item) => item.id === id);

    if (!musica) return;

    try {
        // Guarda a imagem no IndexedDB.
        await salvarCapaNoBanco(id, imagem);

        // Libera a URL da capa anterior.
        if (musica.capaURL) {
            URL.revokeObjectURL(musica.capaURL);
        }

        // Atualiza a música na memória.
        musica.capa = imagem;
        musica.capaURL = URL.createObjectURL(imagem);

        // Atualiza a lista.
        renderizarMusicas();

        // Atualiza também a capa do player, se for a música atual.
        if (musicas[musicaAtual]?.id === id) {
            atualizarCapaPlayer(musica);
        }
    } catch (erro) {
        console.error("Erro ao salvar a capa:", erro);
        alert("Não foi possível salvar a capa escolhida.");
    } finally {
        seletorCapa.value = "";
        musicaSelecionadaParaCapa = null;
    }
});

// Atualiza a imagem no player inferior.
function atualizarCapaPlayer(musica) {
    if (!capaAtual) return;

    capaAtual.style.backgroundImage = musica.capaURL
        ? `url("${musica.capaURL}")`
        : "none";

    capaAtual.style.backgroundSize = "cover";
    capaAtual.style.backgroundPosition = "center";
    capaAtual.style.backgroundRepeat = "no-repeat";

    capaAtual.textContent = musica.capaURL ? "" : "♫";
}

// Desenha a biblioteca na tela.
function renderizarMusicas() {
    const termo = busca.value.toLowerCase().trim();

    const filtradas = musicas
        .map((musica, indice) => ({ musica, indice }))
        .filter(({ musica }) =>
            musica.nome.toLowerCase().includes(termo)
        );

    listaMusicas.innerHTML = "";

    if (filtradas.length === 0) {
        const mensagem = document.createElement("p");
        mensagem.className = "empty-message";
        mensagem.textContent = musicas.length === 0
            ? "Adicione músicas do seu computador para começar."
            : "Nenhuma música encontrada.";

        listaMusicas.appendChild(mensagem);
        return;
    }

    filtradas.forEach(({ musica, indice }) => {
        const item = document.createElement("div");
        item.className = "song-item";
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.setAttribute("aria-label", "Tocar " + musica.nome);

        // Capa da música.
        let capa;

        if (musica.capaURL) {
            capa = document.createElement("img");
            capa.className = "song-cover-image";
            capa.src = musica.capaURL;
            capa.alt = "Capa de " + musica.nome;
        } else {
            capa = document.createElement("div");
            capa.className = "song-cover";
            capa.textContent = "♫";
        }

        // Informações da faixa.
        const informacoes = document.createElement("div");
        informacoes.className = "song-info";

        const titulo = document.createElement("strong");
        titulo.textContent = musica.nome;

        const detalhe = document.createElement("span");
        detalhe.textContent = "Arquivo local";

        informacoes.append(titulo, detalhe);

        // Botão para escolher ou trocar a capa.
        const botaoCapa = document.createElement("button");
        botaoCapa.type = "button";
        botaoCapa.className = "botao-capa";
        botaoCapa.textContent = musica.capaURL
            ? "Trocar capa"
            : "＋ Capa";
        botaoCapa.title = "Escolher uma imagem para " + musica.nome;
        botaoCapa.setAttribute(
            "aria-label",
            "Escolher capa para " + musica.nome
        );

        // Impede que clicar no botão também inicie a música.
        botaoCapa.addEventListener("click", (evento) => {
            evento.stopPropagation();
            escolherCapa(musica);
        });

        botaoCapa.addEventListener("keydown", (evento) => {
            evento.stopPropagation();
        });

        
const botaoRemover = document.createElement("button");
botaoRemover.type = "button";
botaoRemover.className = "botao-remover";
botaoRemover.textContent = "🗑 Remover";
botaoRemover.title = "Remover música da biblioteca";
botaoRemover.setAttribute(
    "aria-label",
    "Remover " + musica.nome + " da biblioteca"
);

botaoRemover.addEventListener("click", (evento) => {
    evento.stopPropagation();
    removerMusica(musica);
});

botaoRemover.addEventListener("keydown", (evento) => {
    evento.stopPropagation();
});

item.append(capa, informacoes, botaoCapa, botaoRemover);


        item.addEventListener("click", () => tocarMusica(indice));

        item.addEventListener("keydown", (evento) => {
            if (
                evento.target === item &&
                (evento.key === "Enter" || evento.key === " ")
            ) {
                evento.preventDefault();
                tocarMusica(indice);
            }
        });

        listaMusicas.appendChild(item);
    });
}

// Reproduz uma faixa.
async function tocarMusica(indice) {
    if (indice < 0 || indice >= musicas.length) return;

    musicaAtual = indice;
    const musica = musicas[indice];

    audio.src = musica.url;
    tituloAtual.textContent = musica.nome;
    artistaAtual.textContent = "Arquivo local";

    atualizarCapaPlayer(musica);

    progresso.value = 0;
    tempoAtual.textContent = "0:00";
    duracao.textContent = "0:00";
    botaoPlay.textContent = "▶";

    try {
        await audio.play();
        botaoPlay.textContent = "Ⅱ";
    } catch (erro) {
        console.error("Não foi possível reproduzir:", erro);
    }
}

// Reproduzir e pausar.
botaoPlay.addEventListener("click", async () => {
    if (musicaAtual === -1) {
        if (musicas.length > 0) {
            await tocarMusica(0);
        } else {
            botaoImportar.click();
        }

        return;
    }

    if (audio.paused) {
        try {
            await audio.play();
            botaoPlay.textContent = "Ⅱ";
        } catch (erro) {
            console.error("Erro ao retomar:", erro);
        }
    } else {
        audio.pause();
        botaoPlay.textContent = "▶";
    }
});

// Próxima música.
botaoProxima.addEventListener("click", () => {
    if (musicas.length === 0) return;

    const proxima = musicaAtual < 0
        ? 0
        : (musicaAtual + 1) % musicas.length;

    tocarMusica(proxima);
});

// Música anterior.
botaoAnterior.addEventListener("click", () => {
    if (musicas.length === 0) return;

    if (musicaAtual >= 0 && audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }

    const anterior = musicaAtual < 0
        ? 0
        : (musicaAtual - 1 + musicas.length) % musicas.length;

    tocarMusica(anterior);
});

// Passa automaticamente para a próxima faixa.
audio.addEventListener("ended", () => {
    if (musicas.length > 0) {
        tocarMusica((musicaAtual + 1) % musicas.length);
    }
});

// Formata o tempo.
function formatarTempo(segundos) {
    if (!Number.isFinite(segundos)) return "0:00";

    const minutos = Math.floor(segundos / 60);
    const restantes = Math.floor(segundos % 60);

    return `${minutos}:${String(restantes).padStart(2, "0")}`;
}

// Atualiza o progresso da reprodução.
audio.addEventListener("timeupdate", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        progresso.value = 0;
        return;
    }

    progresso.value = (audio.currentTime / audio.duration) * 100;
    tempoAtual.textContent = formatarTempo(audio.currentTime);
    duracao.textContent = formatarTempo(audio.duration);
});


audio.addEventListener("loadedmetadata", () => {
    console.log("Duração informada:", audio.duration);
    console.log("Duração formatada:", formatarTempo(audio.duration));
});

audio.addEventListener("durationchange", () => {
    console.log("Duração atualizada:", audio.duration);
});

function atualizarDuracao() {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
        duracao.textContent = formatarTempo(audio.duration);
    }
}

// Permite escolher um ponto da música.
progresso.addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime =
            (Number(progresso.value) / 100) * audio.duration;
    }
});

// Volume.
audio.volume = Number(controleVolume.value);

controleVolume.addEventListener("input", () => {
    audio.volume = Number(controleVolume.value);
});

// Pesquisa.
busca.addEventListener("input", renderizarMusicas);

// Recupera a biblioteca ao iniciar.
carregarBiblioteca();

// Prepara o funcionamento offline do aplicativo.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./service-worker.js")
            .then(() => {
                console.log("Modo offline preparado.");
            })
            .catch((erro) => {
                console.error(
                    "Erro ao preparar o modo offline:",
                    erro
                );
            });
    });
}

setTimeout(() => {
    console.log("Duração atual:", audio.duration);
}, 5000);