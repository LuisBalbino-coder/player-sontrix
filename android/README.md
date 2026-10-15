# Sontrix para Android (em desenvolvimento)

Esta pasta contém a versão Android nativa do Sontrix, separada do site/PWA.

## Objetivo inicial
- Importar arquivos de áudio do armazenamento do celular.
- Reproduzir pelo serviço de mídia do Android, para permitir continuar tocando ao sair da tela e bloquear o celular.
- Exibir controles de mídia do sistema/notificação.
- Manter a biblioteca no próprio aparelho.

## Privacidade e biblioteca
O app usa os arquivos escolhidos pelo usuário e guarda as referências localmente. Não envia músicas para o GitHub. A biblioteca do PWA atual fica separada; não apague os dados do site enquanto a versão Android é desenvolvida.

## Compilação
Abra a pasta `android` no Android Studio com o Android SDK instalado. O projeto ainda está em fase inicial e precisa ser compilado e testado em um aparelho real antes de ser considerado pronto.

## Importante
Esta versão nativa não substitui nem altera o site publicado. Todo o desenvolvimento acontece na branch `android-native`.
