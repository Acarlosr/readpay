# ReadPay 💸📖

> Pague pelo que você lê — não por uma assinatura.
> Uma extensão de navegador que paga artigos automaticamente via **nanopagamentos x402** em USDC, liquidados na **Arc** (a L1 da Circle).

**ReadPay** detecta quando uma página está protegida pelo padrão x402 (`HTTP 402 Payment Required`), desbloqueia o conteúdo pagando alguns centavos de dólar em USDC e mostra ao leitor exatamente quanto gastou — tudo sem cadastro, sem cartão e sem assinatura mensal. Pensado para o leitor que quer ler *aquele* artigo, não pagar R$50/mês por um veículo inteiro.

Construído para o **Lepton Agents Hackathon** (Canteen × Circle × Arc) — RFB 6: *Creator & Publisher Monetization*.

---

## Sumário

- [O problema](#o-problema)
- [A solução](#a-solução)
- [Como funciona](#como-funciona)
- [Arquitetura](#arquitetura)
- [Stack técnica](#stack-técnica)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Roadmap](#roadmap)
- [Segurança e privacidade](#segurança-e-privacidade)
- [Limitações conhecidas](#limitações-conhecidas)
- [Aviso legal](#aviso-legal)
- [Licença](#licença)

---

## O problema

Por décadas, um pagamento online não podia ser menor que ~R$1,50 depois das taxas. Então não havia como vender um artigo de R$0,25 ou uma música de R$0,05. A única saída era empacotar um mês de conteúdo e cobrar R$10–50. **Toda assinatura é a admissão silenciosa de que a unidade real era pequena demais para ser vendida sozinha.**

O resultado:

- O leitor paga por 50 artigos quando só queria ler 1.
- O jornalista independente não tem como ser pago por um leitor avulso.
- Paywalls forçam a escolha "assina tudo ou não lê nada".

## A solução

Os **nanopagamentos** removem o piso. Valores tão baixos quanto **$0.000001**, gás pago em USDC (não numa moeda volátil), liquidados em **menos de 500ms** na Arc com batching sem gás. A menor unidade volta a ser vendável.

**ReadPay** é a ponta do leitor desse novo modelo: uma extensão de navegador que, ao encontrar um paywall x402, paga o valor pedido (ex.: $0.05) automaticamente — ou pede sua confirmação, conforme sua configuração — e o artigo aparece. Você vê um contador rodando: *"Você gastou $0.37 hoje em 6 artigos."*

---

## Como funciona

O fluxo segue o padrão aberto **x402** sobre o **Circle Gateway** (nanopayments), tudo do lado do cliente:

```
┌──────────┐   1. GET /artigo        ┌─────────────────────┐
│  ReadPay │ ──────────────────────► │  Servidor do        │
│ (browser)│                         │  publisher (x402)   │
│          │ ◄────────────────────── │                     │
└──────────┘   2. HTTP 402           └─────────────────────┘
     │            { token: USDC, valor: 0.05,
     │              destino: 0xPublisher, chain: Arc }
     │
     │ 3. Assina autorização EIP-3009 (offchain, zero gás)
     │    usando o saldo do Gateway Wallet do leitor
     ▼
┌──────────┐   4. GET /artigo + header X-PAYMENT   ┌─────────────────────┐
│  ReadPay │ ────────────────────────────────────► │  Servidor do        │
│          │ ◄──────────────────────────────────── │  publisher          │
└──────────┘   5. 200 OK + conteúdo desbloqueado   └─────────────────────┘
     │
     │ 6. O Gateway agrega as autorizações e liquida
     │    em lote na Arc (batched settlement) — o
     │    publisher recebe USDC sem pagar gás por pagamento.
     ▼
  Contador de gastos atualizado no popup
```

**Passo a passo:**

1. O leitor faz **um depósito único** de USDC no contrato Gateway Wallet (transação onchain, feita uma vez).
2. Ao abrir uma página protegida, o servidor responde `402 Payment Required` com os detalhes (token, valor, carteira de destino, chain).
3. O ReadPay assina uma **autorização EIP-3009** — offchain, sem gás — debitando do saldo unificado do Gateway.
4. O ReadPay repete a requisição com a prova de pagamento no header `X-PAYMENT`.
5. O servidor valida a assinatura e entrega o conteúdo **na hora**.
6. O Gateway coleta as autorizações e **liquida em lote** na Arc depois, mantendo a experiência sub-segundo.

> A mágica de UX: o leitor nunca aprova transação a transação. Ele aprova **uma taxa de gasto** (ex.: "até $2/dia, até $0.10 por artigo") e o ReadPay decide dentro desse limite.

---

## Arquitetura

ReadPay é uma extensão **Manifest V3** dividida em três partes:

| Componente | Papel | Tecnologia |
|---|---|---|
| **Service Worker** (background) | Intercepta respostas `402`, orquestra o fluxo de pagamento, guarda o orçamento e o histórico | `@x402/fetch`, `@x402/evm`, `viem` |
| **Content Script** | Detecta paywalls na página, injeta o conteúdo desbloqueado, mostra o badge "pago" | DOM API, mensagens via `chrome.runtime` |
| **Popup (UI)** | Painel do leitor: saldo do Gateway, gasto do dia, limites, histórico, on/off | React + Tailwind |

O **wallet do leitor** vive localmente (chave criptografada no `chrome.storage` ou conectada via carteira externa). Nenhum servidor próprio é necessário — ReadPay é 100% cliente. O publisher é qualquer endpoint x402; nada precisa ser modificado do lado dele além de já suportar x402.

---

## Stack técnica

- **Extensão:** Chrome/Edge Manifest V3 (compatível com Brave; Firefox no roadmap)
- **UI:** React 18 + TypeScript + Tailwind CSS
- **Pagamentos:** [`@x402/fetch`](https://www.npmjs.com/package/x402-fetch) + `@x402/evm` (padrão x402)
- **Assinatura/wallet:** [`viem`](https://viem.sh) (signer EVM, EIP-3009)
- **Liquidação:** [Circle Gateway — Nanopayments](https://developers.circle.com/gateway/nanopayments)
- **Rede:** [Arc Testnet](https://docs.arc.network/) (USDC como gás nativo, finalidade < 500ms)
- **Moeda:** USDC (e EURC no roadmap)
- **Build:** Vite + `@crxjs/vite-plugin`

---

## Pré-requisitos

- **Node.js** v20.18.2 ou superior
- **npm** v10+ (ou pnpm/yarn)
- Navegador baseado em Chromium (Chrome, Edge ou Brave)
- Uma carteira EVM com **USDC de testnet na Arc** — pegue no [faucet da Circle](https://faucet.circle.com/) (selecione Arc Testnet)
- (Opcional, mas recomendado) **Circle CLI** para criar a carteira do agente:
  ```bash
  npm install -g @circle-fin/cli
  ```
- (Opcional) **ARC CLI** do Canteen, que já traz RPC da Arc + docs como contexto para agentes de código:
  ```bash
  uv tool install git+https://github.com/the-canteen-dev/ARC-cli
  ```

---

## Instalação

```bash
# 1. Clonar o repositório
git clone https://github.com/Acarlosr/readpay.git
cd readpay

# 2. Instalar dependências
npm install

# 3. Build de desenvolvimento (watch)
npm run dev

# 4. Build de produção
npm run build
```

**Carregar a extensão no navegador:**

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação** (*Load unpacked*)
4. Selecione a pasta `dist/` gerada pelo build

---

## Configuração

Crie um arquivo `.env` na raiz (use `.env.example` como base):

```env
# Rede
ARC_RPC_URL=https://rpc.testnet.arc.network        # ou o RPC do Canteen
ARC_CHAIN_ID=                                        # preencher com o chainId da Arc Testnet
USDC_CONTRACT=                                       # endereço do USDC na Arc Testnet

# Circle Gateway
GATEWAY_WALLET_ADDRESS=                              # contrato Gateway Wallet
GATEWAY_API_BASE=https://api.circle.com/v1/gateway   # confirmar na doc da Circle

# Limites padrão do leitor (podem ser alterados no popup)
DEFAULT_DAILY_LIMIT_USDC=2.00
DEFAULT_PER_ARTICLE_MAX_USDC=0.10
AUTO_PAY=true                                         # false = pede confirmação a cada artigo
```

> ⚠️ **Nunca** comite o `.env` nem chaves privadas. O `.gitignore` já ignora `.env` e `*.key`. Para o hackathon, use **apenas fundos de testnet**.

Valores como `ARC_CHAIN_ID`, `USDC_CONTRACT` e `GATEWAY_WALLET_ADDRESS` ficam na [documentação da Arc](https://docs.arc.network/) e no [Gateway da Circle](https://developers.circle.com/gateway/nanopayments). O exemplo de referência [`circlefin/arc-nanopayments`](https://github.com/circlefin/arc-nanopayments) já traz esses valores configurados — copie de lá.

---

## Uso

1. **Deposite USDC** no Gateway uma vez (botão "Add funds" no popup → assina a transação onchain).
2. **Defina seus limites** (ex.: $2/dia, máx. $0.10 por artigo). Decida se o pagamento é automático ou com confirmação.
3. **Navegue normalmente.** Quando você abre um artigo protegido por x402:
   - **Modo automático:** o ReadPay paga e o conteúdo aparece em < 1s. Um badge discreto mostra *"Pago $0.05"*.
   - **Modo confirmação:** aparece um prompt *"Desbloquear este artigo por $0.05?"* → você clica e lê.
4. **Acompanhe seus gastos** no popup: total do dia, número de artigos, histórico com link para cada um.

**Exemplo de uso programático do core de pagamento** (`src/payment/client.ts`):

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { createX402Client, registerEvmScheme } from "@x402/evm";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Cria o signer a partir da carteira local do leitor
const account = privateKeyToAccount(readerPrivateKey);
const walletClient = createWalletClient({
  account,
  transport: http(process.env.ARC_RPC_URL),
});

// Registra o esquema EVM (EIP-3009 / Gateway)
const x402 = createX402Client();
registerEvmScheme(x402, { walletClient });

// fetch que lida com 402 automaticamente, respeitando o orçamento
const payFetch = wrapFetchWithPayment(fetch, x402, {
  maxAmountPerRequest: perArticleMaxUsdc,   // trava de segurança por artigo
});

// Uso normal — o pagamento acontece transparentemente
const res = await payFetch(articleUrl);
const html = await res.text();   // conteúdo desbloqueado
```

> ℹ️ Os nomes exatos de funções/pacotes (`@x402/fetch`, `@x402/evm`, `wrapFetchWithPayment`) podem variar conforme a versão. Confirme no [Quickstart for Buyers](https://x402.gitbook.io/x402/getting-started/quickstart-for-buyers) e no repo de referência antes de fixar as versões no `package.json`.

---

## Estrutura do projeto

```
readpay/
├── manifest.json              # Manifest V3
├── vite.config.ts
├── .env.example
├── src/
│   ├── background/
│   │   └── service-worker.ts  # intercepta 402, orquestra pagamento, orçamento
│   ├── content/
│   │   └── content-script.ts  # detecta paywall, injeta conteúdo, badge
│   ├── payment/
│   │   ├── client.ts          # wrapper x402 + viem (core)
│   │   ├── budget.ts          # limites diário / por artigo
│   │   └── history.ts         # registro de gastos (chrome.storage)
│   ├── popup/
│   │   ├── App.tsx            # painel do leitor
│   │   ├── components/
│   │   └── index.tsx
│   └── lib/
│       └── arc.ts             # config de rede / USDC / Gateway
├── public/
│   └── icons/
└── README.md
```

---

## Roadmap

- [ ] **MVP:** detectar 402, pagar com confirmação, mostrar contador (meta do hackathon)
- [ ] Modo **auto-pay** com limites diário e por artigo
- [ ] Histórico com export CSV
- [ ] Suporte a **EURC** além de USDC
- [ ] Botão **"apoiar o autor"** (tip extra além do preço do artigo)
- [ ] Suporte a **Firefox** (Manifest V3)
- [ ] Modo "lista de leitura por IA": um agente que paga automaticamente pelas fontes que você consome
- [ ] Receipts on-chain verificáveis por artigo

---

## Segurança e privacidade

- **Custódia local:** a chave do leitor fica criptografada no `chrome.storage` ou é delegada a uma carteira externa. Nenhuma chave sai do dispositivo.
- **Limites obrigatórios:** todo pagamento passa por uma trava de orçamento (por artigo e por dia). O ReadPay **nunca** paga acima do limite configurado.
- **Sem servidor próprio:** ReadPay não roda backend nem coleta dados de navegação. O histórico de gastos fica só no seu navegador.
- **Testnet primeiro:** para o hackathon e desenvolvimento, use exclusivamente fundos de testnet da Arc.
- **EIP-3009 offchain:** as autorizações de pagamento são assinaturas offchain de valor limitado — não dão acesso à carteira inteira.

---

## Limitações conhecidas

- Funciona apenas em páginas que **já implementam o padrão x402**. Sites com paywall tradicional (login/cookie) não são suportados — esse é o ponto: ReadPay é a ponta do leitor de um ecossistema x402 nascente.
- Em testnet, a disponibilidade de publishers x402 é limitada; para o demo, inclua um **publisher de exemplo** (veja `circlefin/arc-nanopayments`, que traz endpoints x402 prontos para testar).
- Manifest V3 limita execução em background; pagamentos muito frequentes em paralelo podem precisar de fila.

---

## Aviso legal

Projeto de demonstração construído para o **Lepton Agents Hackathon** (Canteen × Circle × Arc). Não é um produto da Circle nem da Arc. A Arc testnet é oferecida pela Circle Technology Services, LLC. Use apenas fundos de testnet. Nada aqui constitui aconselhamento financeiro. Você é responsável por cumprir as leis aplicáveis ao uso e à distribuição de qualquer versão deste software.

---

## Licença

MIT © 2026 Carlos Rocha — [GitHub](https://github.com/Acarlosr)

---

### Links úteis

- [Lepton Agents Hackathon](https://lepton.thecanteenapp.com/)
- [Arc Developer Docs](https://docs.arc.network/)
- [Circle Nanopayments (Gateway)](https://developers.circle.com/gateway/nanopayments)
- [Padrão x402](https://www.x402.org/)
- [Repo de referência: circlefin/arc-nanopayments](https://github.com/circlefin/arc-nanopayments)
- [Faucet da Circle (Arc Testnet)](https://faucet.circle.com/)
