# Peladeiros FTV — Admin

Painel admin para atualizar jogos e ranking via foto da planilha.

## Estrutura
```
peladeiros-admin/
├── index.html          ← página do admin
├── api/
│   └── processar.js    ← Vercel Function (backend)
└── vercel.json         ← configuração Vercel
```

## Deploy no Vercel

### 1. Criar repositório no GitHub
Cria um repo novo (ex: `peladeiros-admin`) e faz push desses arquivos.

### 2. Importar no Vercel
- Acessa vercel.com → New Project → importa o repo `peladeiros-admin`
- Framework: **Other**
- Clica em Deploy

### 3. Configurar variáveis de ambiente
No Vercel → Project → Settings → Environment Variables, adiciona:

| Nome | Valor |
|------|-------|
| `ANTHROPIC_API_KEY` | sua chave da API da Anthropic |
| `GITHUB_TOKEN` | token do GitHub com permissão `repo` |

**Como gerar o GitHub Token:**
- github.com → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
- Marcar `repo` → Generate token

**Como obter a Anthropic API Key:**
- console.anthropic.com → API Keys → Create Key

### 4. Pronto!
Após o deploy, o link do Vercel é a URL do admin.
Compartilha com os membros da pelada — ninguém precisa de token, tudo fica no servidor.

## Como usar
1. Acessa o link do admin
2. Faz upload da foto da planilha
3. A IA interpreta os jogos automaticamente
4. Confirma os dados
5. Clica em Publicar — o site atualiza em segundos!
