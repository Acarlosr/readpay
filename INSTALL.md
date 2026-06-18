# ReadPay — Guia de Instalação e Teste (Arc Testnet)

## Pré-requisitos

- Node.js v20+ (`node -v`)
- Chrome, Edge ou Brave
- USDC testnet na Arc — pegue em [faucet.circle.com](https://faucet.circle.com) (selecione **Arc Testnet**)

---

## 1. Instalar dependências

```bash
npm install
```

---

## 2. Configurar ambiente

```bash
cp .env.example .env
```

### Gerar carteiras de testnet

```bash
node -e "
const {generatePrivateKey, privateKeyToAccount} = await import('viem/accounts');
const readerKey  = generatePrivateKey();
const publisherKey = generatePrivateKey();
console.log('READER_PRIVATE_KEY=' + readerKey);
console.log('  Endereço leitor: ' + privateKeyToAccount(readerKey).address);
console.log('');
console.log('PUBLISHER_PRIVATE_KEY=' + publisherKey);
console.log('PUBLISHER_ADDRESS=' + privateKeyToAccount(publisherKey).address);
" --input-type=module
```

Cole os valores gerados no `.env`. Depois obtenha USDC de testnet para o endereço do leitor em [faucet.circle.com](https://faucet.circle.com).

---

## 3. Build da extensão

```bash
npm run build
```

O build gera a pasta `dist/`.

### Carregar no Chrome

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique **Carregar sem compactação**
4. Selecione a pasta `dist/`

---

## 4. Configurar a extensão

1. Clique no ícone ReadPay na barra do Chrome
2. Cole sua **chave privada de testnet** (0x...)
3. Defina uma senha de criptografia
4. Clique **Set up wallet**

A chave é criptografada com AES-256 e fica só no seu navegador.

---

## 5. Rodar o servidor de demo (publisher local)

O servidor expõe endpoints x402-protected para testar o ReadPay sem depender de sites externos.

```bash
npm run demo-server
```

Você verá:
```
🚀 ReadPay Demo Publisher at http://localhost:3001

Endpoints protegidos (x402 · Arc Testnet):
  GET /api/article    $0.01  — artigo completo
  GET /api/summary    $0.001 — resumo sub-cent
  GET /api/premium    $0.05  — análise premium
  GET /health         free   — status
```

### Testar manualmente

```bash
# Health check (grátis)
curl http://localhost:3001/health

# Artigo protegido — deve retornar 402
curl -i http://localhost:3001/api/article
```

### Testar com o ReadPay

Com a extensão configurada e o servidor rodando, abra no Chrome:

```
http://localhost:3001/api/article
```

O ReadPay detecta o 402, paga $0.01 em USDC na Arc Testnet, e exibe o conteúdo desbloqueado com um badge verde **"ReadPay ✓ Paid $0.0100"**.

---

## Rede Arc Testnet — referência rápida

| Campo | Valor |
|---|---|
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` |
| Gateway Wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Explorer | [testnet.arcscan.app](https://testnet.arcscan.app) |
| Faucet | [faucet.circle.com](https://faucet.circle.com) |

---

## Estrutura do projeto

```
readpay/
├── src/
│   ├── background/service-worker.ts   # Orquestra pagamentos, guarda estado
│   ├── content/content-script.ts      # Intercepta fetch, detecta 402, badge
│   ├── payment/
│   │   ├── client.ts                  # x402 v2: wrapFetchWithPaymentFromConfig
│   │   ├── budget.ts                  # Limites por dia / por artigo
│   │   └── history.ts                 # Histórico em chrome.storage
│   ├── popup/                         # React UI (setup, unlock, dashboard)
│   └── lib/
│       ├── arc.ts                     # Config Arc Testnet + endereços oficiais
│       └── wallet.ts                  # AES-256 encrypt/decrypt (SubtleCrypto)
├── demo-server/server.ts              # Publisher demo local (x402 + Express)
├── manifest.json                      # Manifest V3
├── .env.example                       # Template de configuração
└── INSTALL.md                         # Este arquivo
```
