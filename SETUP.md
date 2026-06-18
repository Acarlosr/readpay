# Como configurar o ReadPay do zero

> **Este arquivo foi feito para você colar numa IA (ChatGPT, Claude, etc.) e seguir as instruções dela passo a passo.**
> Você não precisa entender nada de código — a IA vai te guiar por cada etapa.

---

## Como usar este guia

1. Abra o ChatGPT ou Claude
2. Cole a mensagem abaixo como primeiro prompt:

---

**Mensagem para colar na IA:**

```
Você vai me ajudar a configurar um projeto chamado ReadPay.
É uma extensão de navegador que paga artigos automaticamente com criptomoeda (USDC) na blockchain Arc.
Vou te mostrar as etapas uma por uma e você me explica o que fazer em cada uma, pedindo confirmação antes de passar para a próxima.
Começa pela Etapa 1.
```

---

Depois que a IA responder, você vai copiando as etapas abaixo e colando na conversa uma por uma. A IA vai te dizer exatamente o que fazer.

---

## Etapa 1 — Instalar o Node.js

**Cole na IA:**

```
Etapa 1: Instalar o Node.js.
Preciso instalar o Node.js versão 20 ou superior no meu computador.
Meu sistema operacional é: [escreva aqui: Windows / Mac / Linux]
Me diz como instalar e como confirmar que instalou certo.
```

✅ Quando a IA disser que está ok, vá para a Etapa 2.

---

## Etapa 2 — Clonar o projeto

**Cole na IA:**

```
Etapa 2: Baixar o projeto ReadPay.
Preciso clonar este repositório do GitHub: https://github.com/Acarlosr/readpay
Me explica como abrir o terminal no meu computador e como rodar o comando git clone.
Também precisa instalar as dependências depois de clonar. Me guia passo a passo.
```

Os comandos que a IA vai te mostrar são esses (mas deixa ela explicar):

```bash
git clone https://github.com/Acarlosr/readpay.git
cd readpay
npm install
```

✅ Quando aparecer algo como "added X packages", está ok. Vá para a Etapa 3.

---

## Etapa 3 — Criar uma carteira de testnet

**Cole na IA:**

```
Etapa 3: Criar carteiras para o projeto.
Preciso criar duas carteiras de testnet: uma para o leitor (quem paga os artigos) e uma para o publisher (quem recebe).
Estou dentro da pasta do projeto "readpay" no terminal.
Me mostra o comando exato para criar essas carteiras usando Node.js.
```

A IA vai te dar um comando parecido com este:

```bash
node --input-type=module << 'EOF'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
const readerKey = generatePrivateKey();
const publisherKey = generatePrivateKey();
console.log('=== LEITOR ===');
console.log('READER_PRIVATE_KEY=' + readerKey);
console.log('Endereço: ' + privateKeyToAccount(readerKey).address);
console.log('');
console.log('=== PUBLISHER ===');
console.log('PUBLISHER_PRIVATE_KEY=' + publisherKey);
console.log('PUBLISHER_ADDRESS=' + privateKeyToAccount(publisherKey).address);
EOF
```

⚠️ **Guarde os valores que aparecerem — você vai precisar deles na próxima etapa.**

---

## Etapa 4 — Criar o arquivo .env

**Cole na IA:**

```
Etapa 4: Criar o arquivo de configuração .env.
Tenho os seguintes valores que foram gerados no passo anterior:

READER_PRIVATE_KEY=[cole aqui o valor que apareceu]
PUBLISHER_PRIVATE_KEY=[cole aqui o valor que apareceu]
PUBLISHER_ADDRESS=[cole aqui o valor que apareceu]

Me ajuda a criar o arquivo .env na raiz do projeto readpay com todos os campos necessários preenchidos.
Os valores fixos da rede Arc Testnet são:
- ARC_RPC_URL: https://rpc.testnet.arc.network
- ARC_CHAIN_ID: 5042002
- USDC_CONTRACT: 0x3600000000000000000000000000000000000000
- GATEWAY_WALLET_ADDRESS: 0x0077777d7EBA4688BDeF3E311b846F25870A19B9
```

✅ A IA vai te mostrar exatamente o conteúdo do arquivo e como criar ele.

---

## Etapa 5 — Pegar USDC grátis (faucet)

**Cole na IA:**

```
Etapa 5: Pegar USDC de testnet grátis para o endereço do leitor.
O endereço do leitor que precisa de USDC é: [cole aqui o endereço do leitor]
Me explica como acessar o faucet da Circle em https://faucet.circle.com e como pedir USDC grátis na Arc Testnet para esse endereço.
```

👉 O site do faucet é: **https://faucet.circle.com**
- Selecione a rede: **Arc Testnet**
- Cole o endereço do leitor
- Clique em "Send" e aguarde

✅ Você vai receber USDC grátis em alguns segundos.

---

## Etapa 6 — Fazer o build da extensão

**Cole na IA:**

```
Etapa 6: Compilar a extensão ReadPay.
Estou na pasta do projeto no terminal.
Preciso rodar o build para gerar a pasta dist/ que vou carregar no Chrome.
Me mostra o comando e como confirmar que funcionou.
```

O comando é:

```bash
npm run build
```

✅ Quando terminar, vai aparecer uma pasta `dist/` dentro do projeto.

---

## Etapa 7 — Instalar a extensão no Chrome

**Cole na IA:**

```
Etapa 7: Instalar a extensão ReadPay no Google Chrome.
A pasta da extensão compilada está em: [caminho completo até a pasta readpay]/dist
Me explica passo a passo como carregar essa extensão no Chrome em modo desenvolvedor.
```

Os passos são:
1. Abrir o Chrome e digitar na barra de endereço: `chrome://extensions`
2. Ativar o **Modo do desenvolvedor** (botão no canto superior direito)
3. Clicar em **Carregar sem compactação** (ou "Load unpacked")
4. Selecionar a pasta `dist/` do projeto

✅ O ícone do ReadPay vai aparecer na barra de extensões do Chrome.

---

## Etapa 8 — Rodar o servidor de demonstração

**Cole na IA:**

```
Etapa 8: Rodar o servidor de demonstração do ReadPay.
Este servidor simula um site que cobra por artigos usando o protocolo x402.
Preciso rodar ele no meu computador para testar o pagamento.
Estou na pasta do projeto. Me mostra como iniciar o servidor e como saber se está funcionando.
```

O comando é:

```bash
npm run demo-server
```

✅ Vai aparecer algo assim:

```
🚀 ReadPay Demo Publisher at http://localhost:3001
  GET /api/article    $0.01
  GET /api/summary    $0.001
  GET /api/premium    $0.05
  GET /health         free
```

---

## Etapa 9 — Testar o pagamento

**Cole na IA:**

```
Etapa 9: Testar o ReadPay.
O servidor de demo está rodando em http://localhost:3001
Preciso:
1. Configurar a extensão com a chave privada do leitor
2. Abrir http://localhost:3001/api/article no Chrome
3. Ver o pagamento acontecer automaticamente

Me guia nesse processo explicando como clicar no ícone da extensão e o que fazer em cada tela.
```

O que vai acontecer:
- Você abre o artigo em `http://localhost:3001/api/article`
- O ReadPay detecta o paywall (HTTP 402)
- Paga automaticamente $0.01 USDC
- Um badge verde **"✓ Paid $0.01"** aparece na página
- O conteúdo do artigo é desbloqueado

---

## Problemas comuns

**Cole na IA se tiver algum problema:**

```
Estou tendo um problema no ReadPay. O erro que aparece é:
[cole aqui o erro exato que apareceu]
Estou na etapa: [número da etapa]
Me ajuda a resolver.
```

---

## Referências úteis

Se a IA precisar de mais contexto, você pode passar estes links:

- Faucet grátis Arc Testnet: https://faucet.circle.com
- Ver transações na blockchain: https://testnet.arcscan.app
- Repositório do projeto: https://github.com/Acarlosr/readpay

---

> **Lembre:** todos os valores usados neste guia são de **testnet** — não é dinheiro real. Você pode experimentar à vontade sem gastar nada.
