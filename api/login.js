export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const ADMIN_USER     = process.env.ADMIN_USER;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_USER || !ADMIN_PASSWORD) {
        return res.status(500).json({ ok: false, error: 'Variáveis de ambiente não configuradas' });
    }

    const { user, password } = req.body;

    if (user === ADMIN_USER && password === ADMIN_PASSWORD) {
        return res.status(200).json({ ok: true });
    }

    return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
}
