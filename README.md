# ♫ Sontrix

Um player de música pessoal para a web, desenvolvido com HTML, CSS e JavaScript.

O Sontrix permite importar músicas do seu dispositivo, organizar sua biblioteca e ouvir suas faixas em uma interface própria. O projeto também conta com recursos de PWA, preparando o player para instalação em dispositivos compatíveis.

## ✨ Funcionalidades

- **Biblioteca pessoal:** importe vários arquivos de áudio do seu dispositivo.
- **Armazenamento local:** músicas importadas ficam salvas no navegador usando IndexedDB.
- **Controles de reprodução:** reproduza, pause, avance e volte entre as faixas.
- **Busca:** encontre músicas na biblioteca.
- **Capas personalizadas:** utilize capas incorporadas aos arquivos ou escolha suas próprias imagens.
- **Controles de áudio:** ajuste o volume e navegue pela barra de progresso.
- **Remoção de músicas:** retire faixas da biblioteca quando quiser.
- **PWA:** manifesto e service worker para oferecer suporte à instalação e a recursos offline.

## 🛠️ Tecnologias

- HTML5
- CSS3
- JavaScript
- IndexedDB
- Service Workers
- Progressive Web App (PWA)
- [jsmediatags](https://github.com/aadsm/jsmediatags), para leitura de metadados de arquivos de áudio.

## 🚀 Como executar

1. Clone o repositório:

   ```bash
   git clone https://github.com/LuisBalbino-coder/player-sontrix.git
   ```

2. Entre na pasta do projeto:

   ```bash
   cd player-sontrix
   ```

3. Inicie um servidor HTTP local com Python 3:

   ```bash
   python3 -m http.server 8000
   ```

4. Abra o navegador e acesse:

   http://localhost:8000

## 🔒 Privacidade

A biblioteca de músicas é armazenada localmente no navegador por meio do IndexedDB. Os arquivos de áudio pessoais não precisam ser enviados ao GitHub para utilizar o player.

**Atenção:** os dados ficam associados ao navegador e à origem do site. Limpar os dados do site ou mudar o endereço pode fazer com que a biblioteca não apareça no novo ambiente.

## 📱 Instalação

O Sontrix inclui um manifesto PWA. A instalação depende da publicação em uma origem compatível, normalmente HTTPS, e do suporte do navegador e do dispositivo.

## 📌 Status do projeto

Em desenvolvimento. Novas melhorias e recursos poderão ser adicionados ao longo do tempo.

## 👨‍💻 Autor

             Desenvolvido por [LuisBalbino-coder](https://github.com/LuisBalbino-coder).

---

                            *Sontrix — Seu espaço, sua música.*
