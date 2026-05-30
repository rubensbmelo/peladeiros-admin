export const config = { maxDuration: 30 };

const GITHUB_USER = 'rubensbmelo';
const GITHUB_REPO = 'PeladeirosFTV';
const FILE_JOGOS  = 'dados_jogos.js';
const FILE_RANK   = 'dados_ranking.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;

    if (!ANTHROPIC_KEY || !GITHUB_TOKEN) {
        return res.status(500).json({ error: 'Variáveis de ambiente não configuradas' });
    }

    try {
        const { imageBase64, imageMime, acao } = req.body;

        // ── AÇÃO: interpretar ──────────────────────────────────────
        if (acao === 'interpretar') {
            if (!imageBase64 || !imageMime) {
                return res.status(400).json({ error: 'Imagem não enviada' });
            }

            // Busca arquivo de jogos atual para referência de nomes
            const jogosAtual = await fetchGitHubFile(GITHUB_TOKEN, FILE_JOGOS);

            const prompt = `Você é um sistema de leitura de planilhas de futevôlei.
Analise a imagem desta planilha de jogos e extraia os dados.

Retorne APENAS um JSON válido, sem markdown, sem explicações, no formato:
{
  "data": "DD/MM/AAAA",
  "jogos": [
    { "t1": "Nome1 / Nome2", "p": "15 x 8", "t2": "Nome3 / Nome4" },
    ...
  ],
  "convidados": ["Nome1", "Nome2"]
}

Regras:
- "t1" é sempre o VENCEDOR (quem fez o placar maior)
- "p" é o placar no formato "X x Y" onde X é de t1
- Use "/" entre os nomes da dupla
- Normalize abreviações usando os nomes do arquivo de referência abaixo
- Liste em "convidados" quem parece ser diarista/visitante (não é fixo)
- Se a data não estiver clara, use "00/00/0000"

Arquivo atual de jogos para referência dos nomes:
${jogosAtual.substring(0, 2000)}`;

            const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': ANTHROPIC_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 2000,
                    messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: { type: 'base64', media_type: imageMime, data: imageBase64 }
                            },
                            { type: 'text', text: prompt }
                        ]
                    }]
                })
            });

            const claudeData = await claudeRes.json();
            if (!claudeRes.ok) throw new Error(claudeData.error?.message || 'Erro na API Claude');

            const text = claudeData.content.map(b => b.text || '').join('');
            const clean = text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(clean);

            // Calcular vitórias por jogador (excluindo convidados)
            const wins = {};
            const convidados = (parsed.convidados || []).map(n => n.toLowerCase());
            for (const jogo of parsed.jogos) {
                for (const nome of jogo.t1.split('/').map(n => n.trim())) {
                    if (!convidados.some(c => nome.toLowerCase().includes(c))) {
                        wins[nome] = (wins[nome] || 0) + 1;
                    }
                }
            }
            parsed.wins = wins;

            return res.status(200).json({ ok: true, data: parsed });
        }

        // ── AÇÃO: publicar ─────────────────────────────────────────
        if (acao === 'publicar') {
            const { dados } = req.body;
            if (!dados) return res.status(400).json({ error: 'Dados não enviados' });

            // 1. Atualizar dados_jogos.js
            let jogosCode = await fetchGitHubFile(GITHUB_TOKEN, FILE_JOGOS);
            jogosCode = jogosCode.replace(/atual: true/g, 'atual: false');

            let newEntry = `    {\n        data: "${dados.data}",\n        atual: true,\n        jogos: [\n`;
            for (const j of dados.jogos) {
                newEntry += `            { t1: "${j.t1}", p: "${j.p}", t2: "${j.t2}" },\n`;
            }
            newEntry += `        ]\n    },\n`;

            const newJogosCode = jogosCode.replace(
                /const bancoDeDadosJogos = \[/,
                `const bancoDeDadosJogos = [\n${newEntry}`
            );

            await commitFile(GITHUB_TOKEN, FILE_JOGOS, newJogosCode, `Jogos ${dados.data}`);

            // 2. Atualizar dados_ranking.js
            if (dados.wins && Object.keys(dados.wins).length > 0) {
                let rankCode = await fetchGitHubFile(GITHUB_TOKEN, FILE_RANK);

                for (const [nome, delta] of Object.entries(dados.wins)) {
                    rankCode = rankCode.replace(
                        new RegExp(`(nome: "${nome}"[^}]*total: )(\\d+)([^}]*mes: )(\\d+)`),
                        (match, p1, total, p3, mes) =>
                            `${p1}${parseInt(total) + delta}${p3}${parseInt(mes) + delta}`
                    );
                }

                await commitFile(GITHUB_TOKEN, FILE_RANK, rankCode, `Ranking ${dados.data}`);
            }

            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Ação inválida' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}

// ── GitHub helpers ─────────────────────────────────────────────────────────
async function fetchGitHubFile(token, filename) {
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${filename}`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    if (!res.ok) throw new Error(`Erro ao buscar ${filename}: ${res.status}`);
    const data = await res.json();
    return Buffer.from(data.content, 'base64').toString('utf8');
}

async function commitFile(token, filename, content, message) {
    const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${filename}`;
    const getRes = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    if (!getRes.ok) throw new Error(`Erro ao buscar SHA de ${filename}`);
    const { sha } = await getRes.json();

    const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `[admin] ${message}`,
            content: Buffer.from(content).toString('base64'),
            sha
        })
    });

    if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(err.message || `Erro ao commitar ${filename}`);
    }
}
