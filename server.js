import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());

const publicDir = process.env.PUBLIC_PATH || path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.use(session({
    secret: 'spumacar_super_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 12 } // 12 horas
}));

// ================== MIDDLEWARES ==================
const checkAuth = (req, res, next) => {
    if (req.session.userId) next();
    else res.status(401).json({ error: 'Não autorizado' });
};
const checkAdmin = (req, res, next) => {
    if (req.session.userRole === 'admin') next();
    else res.status(403).json({ error: 'Acesso negado' });
};

// ================== LOGIN / SESSÃO ==================
app.get('/api/check-setup', (req, res) => {
    db.get("SELECT COUNT(*) as count FROM usuarios", (err, row) => {
        res.json({ needsSetup: row.count === 0 });
    });
});

app.post('/api/setup', async (req, res) => {
    db.get("SELECT COUNT(*) as count FROM usuarios", async (err, row) => {
        if (row.count > 0) return res.status(400).json({error: 'Setup já realizado'});
        const hash = await bcrypt.hash(req.body.senha, 10);
        db.run("INSERT INTO usuarios (login, senha, perfil) VALUES (?, ?, 'admin')", [req.body.login, hash], function(err) {
            if (err) return res.status(500).json({error: err.message});
            res.json({success: true});
        });
    });
});

app.post('/api/login', (req, res) => {
    const { login, senha } = req.body;
    // Usamos LOWER() tanto na coluna do banco quanto no texto digitado para garantir a igualdade
    db.get("SELECT * FROM usuarios WHERE LOWER(login) = LOWER(?)", [login], async (err, user) => {
        if (!user || !(await bcrypt.compare(senha, user.senha))) return res.status(401).json({ error: 'Credenciais inválidas' });
        req.session.userId = user.id;
        req.session.userRole = user.perfil;
        req.session.login = user.login;
        res.json({ success: true, perfil: user.perfil });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/check-session', (req, res) => {
    if (req.session.userId) res.json({ logged: true, user: { login: req.session.login, perfil: req.session.userRole } });
    else res.json({ logged: false });
});

// ================== OPERACIONAL (CADASTRO INTELIGENTE) ==================
app.post('/api/lavagem-rapida', checkAuth, (req, res) => {
    // Adicionado servico_extra e valor_extra
    const { placa, modelo, nome, telefone, servico_id, funcionario_id, valor, pgto, obs, servico_extra, valor_extra } = req.body;
    
    db.get("SELECT id FROM clientes WHERE nome = ?", [nome], (err, cliente) => {
        const processarVeiculo = (clienteId) => {
            db.get("SELECT id FROM veiculos WHERE placa = ?", [placa], (err, veiculo) => {
                const registrarTransacao = (veiculoId) => {
                    db.run("INSERT INTO transacoes (cliente_id, veiculo_id, placa_registrada, servico_id, funcionario_id, valor_cobrado, forma_pagamento, obs, servico_extra, valor_extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [clienteId, veiculoId, placa, servico_id, funcionario_id, valor, pgto, obs, servico_extra, valor_extra || 0], (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ success: true });
                    });
                };
                if (veiculo) registrarTransacao(veiculo.id);
                else db.run("INSERT INTO veiculos (placa, modelo, cliente_id) VALUES (?, ?, ?)", [placa, modelo, clienteId], function() { registrarTransacao(this.lastID); });
            });
        };

        if (cliente) {
            if (telefone) db.run("UPDATE clientes SET telefone = ? WHERE id = ? AND (telefone IS NULL OR telefone = '')", [telefone, cliente.id]);
            processarVeiculo(cliente.id);
        } else {
            db.run("INSERT INTO clientes (nome, telefone) VALUES (?, ?)", [nome, telefone], function() { processarVeiculo(this.lastID); });
        }
    });
}); // CORREÇÃO: Removido ponto e vírgula extra

// Busca os agendamentos corrigida (Removida a duplicidade e garantindo retorno do telefone)
app.get('/api/agenda', checkAuth, (req, res) => {
    const sql = `
        SELECT 
            a.*, 
            c.nome as cliente, 
            c.telefone, 
            v.placa, 
            v.modelo, 
            s.nome as servico 
        FROM agendamentos a 
        JOIN clientes c ON a.cliente_id = c.id 
        JOIN veiculos v ON a.veiculo_id = v.id 
        LEFT JOIN servicos s ON a.servico_id = s.id 
        WHERE a.status = 'PENDENTE' 
        ORDER BY a.data_agendada ASC`;

    db.all(sql, (err, rows) => {
        if (err) {
            console.error("Erro ao buscar agenda:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

// Rota para Editar um Agendamento
app.put('/api/agenda/:id', checkAuth, (req, res) => {
    const { data_agendada, servico_id, obs, servico_extra, valor_extra } = req.body;
    
    db.run("UPDATE agendamentos SET data_agendada = ?, servico_id = ?, obs = ?, servico_extra = ?, valor_extra = ? WHERE id = ?", 
    [data_agendada, servico_id, obs, servico_extra, valor_extra || 0, req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message}); 
        res.json({success: true});
    });
});

// Iniciar Serviço Agendado (Proteção contra serviço deletado/sem preço)
app.post('/api/agenda', checkAuth, (req, res) => {
    // Agora recebe os extras
    const { data_agendada, nome, telefone, placa, modelo, servico_id, obs, servico_extra, valor_extra } = req.body;
    db.get("SELECT id FROM clientes WHERE nome = ?", [nome], (err, cliente) => {
        const processarVeiculo = (clienteId) => {
            db.get("SELECT id FROM veiculos WHERE placa = ?", [placa], (err, veiculo) => {
                const registrarAgenda = (veiculoId) => {
                    db.run("INSERT INTO agendamentos (cliente_id, veiculo_id, servico_id, data_agendada, obs, servico_extra, valor_extra) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [clienteId, veiculoId, servico_id, data_agendada, obs, servico_extra, valor_extra || 0], (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ success: true });
                    });
                };
                if (veiculo) registrarAgenda(veiculo.id);
                else db.run("INSERT INTO veiculos (placa, modelo, cliente_id) VALUES (?, ?, ?)", [placa, modelo, clienteId], function() { registrarAgenda(this.lastID); });
            });
        };
        if (cliente) {
            if (telefone) db.run("UPDATE clientes SET telefone = ? WHERE id = ? AND (telefone IS NULL OR telefone = '')", [telefone, cliente.id]);
            processarVeiculo(cliente.id);
        } else {
            db.run("INSERT INTO clientes (nome, telefone) VALUES (?, ?)", [nome, telefone], function() { processarVeiculo(this.lastID); });
        }
    });
});

app.delete('/api/agenda/:id', checkAuth, (req, res) => { db.run("DELETE FROM agendamentos WHERE id = ?", [req.params.id], () => res.json({success:true})); });
app.post('/api/agenda/:id/iniciar', checkAuth, (req, res) => {
    db.get("SELECT * FROM agendamentos WHERE id = ?", [req.params.id], (err, agd) => {
        if(!agd) return res.status(404).json({error:'Não encontrado'});
        db.get("SELECT preco FROM servicos WHERE id = ?", [agd.servico_id], (err, srv) => {
            db.get("SELECT placa FROM veiculos WHERE id = ?", [agd.veiculo_id], (err, veic) => {
                const precoFinal = srv ? srv.preco : 0; 
                const placa = veic ? veic.placa : 'Desconhecida'; // CORREÇÃO: Prevenir erro se veiculo não existir
                // Transfere o extra do agendamento direto para o Pátio (transacoes)
                db.run("INSERT INTO transacoes (cliente_id, veiculo_id, placa_registrada, servico_id, valor_cobrado, forma_pagamento, obs, servico_extra, valor_extra) VALUES (?, ?, ?, ?, ?, 'Pendente', ?, ?, ?)", 
                [agd.cliente_id, agd.veiculo_id, placa, agd.servico_id, precoFinal, agd.obs, agd.servico_extra, agd.valor_extra || 0], (err) => {
                    db.run("UPDATE agendamentos SET status = 'CONCLUIDO' WHERE id = ?", [agd.id]);
                    res.json({success:true});
                });
            });
        });
    });
});

app.get('/api/patio/andamento', checkAuth, (req, res) => {
    // Adicionado t.servico_id na busca
   db.all("SELECT t.id, t.placa_registrada, c.nome as cliente, c.telefone, s.nome as servico, t.servico_id, t.valor_cobrado, t.data_hora, v.modelo, t.obs, t.servico_extra, t.valor_extra FROM transacoes t JOIN clientes c ON t.cliente_id = c.id JOIN servicos s ON t.servico_id = s.id LEFT JOIN veiculos v ON t.veiculo_id = v.id WHERE t.status = 'ANDAMENTO' ORDER BY t.data_hora ASC", (err, rows) => res.json(rows||[]));
});

// Nova rota para salvar a edição do pátio
app.put('/api/patio/:id', checkAuth, (req, res) => {
    db.run("UPDATE transacoes SET servico_id = ?, valor_cobrado = ?, obs = ?, servico_extra = ?, valor_extra = ? WHERE id = ?", 
    [req.body.servico_id, req.body.valor_cobrado, req.body.obs, req.body.servico_extra, req.body.valor_extra || 0, req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message}); res.json({success: true});
    });
});
// Rota para cancelar/excluir um carro que foi lançado errado no pátio
app.delete('/api/patio/:id', checkAuth, (req, res) => {
    db.run("DELETE FROM transacoes WHERE id = ? AND status = 'ANDAMENTO'", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message}); 
        res.json({success: true});
    });
});
app.put('/api/concluir-servico/:id', checkAuth, (req, res) => {
    db.run("UPDATE transacoes SET status = 'CONCLUIDO', data_conclusao = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id], (err) => {
        if(err) return res.status(500).json({error: err.message}); res.json({success: true});
    });
});
app.get('/api/patio/concluidos-hoje', checkAuth, (req, res) => {
    db.all("SELECT t.id, t.placa_registrada, c.nome as cliente, s.nome as servico, t.data_conclusao, v.modelo FROM transacoes t JOIN clientes c ON t.cliente_id = c.id JOIN servicos s ON t.servico_id = s.id LEFT JOIN veiculos v ON t.veiculo_id = v.id WHERE t.status = 'CONCLUIDO' AND date(t.data_conclusao) = date('now', 'localtime') ORDER BY t.data_conclusao DESC", (err, rows) => res.json(rows||[]));
});

// ================== DASHBOARD E RELATÓRIOS ==================
app.get('/api/dashboard', checkAuth, (req, res) => {
    const queries = {
        hoje: "SELECT COUNT(*) as qtd, SUM(valor_cobrado) as total FROM transacoes WHERE status = 'CONCLUIDO' AND date(data_conclusao) = date('now', 'localtime')",
        emAndamento: "SELECT COUNT(*) as qtd FROM transacoes WHERE status = 'ANDAMENTO'",
        mesFat: "SELECT SUM(valor_cobrado) as total FROM transacoes WHERE status = 'CONCLUIDO' AND strftime('%Y-%m', data_conclusao) = strftime('%Y-%m', 'now', 'localtime')",
        mesCusto: "SELECT SUM(t.custo_servico) as total FROM transacoes t WHERE status = 'CONCLUIDO' AND strftime('%Y-%m', data_conclusao) = strftime('%Y-%m', 'now', 'localtime')",
        mesDespesas: "SELECT SUM(valor) as total FROM despesas WHERE strftime('%Y-%m', data_despesa) = strftime('%Y-%m', 'now', 'localtime')",
        mesRH: "SELECT SUM(valor) as total FROM rh_eventos WHERE tipo = 'DEBITO' AND strftime('%Y-%m', data_evento) = strftime('%Y-%m', 'now', 'localtime')"
    };
    db.get(queries.hoje, (e1, hoje) => {
        db.get(queries.emAndamento, (e2, andam) => {
            db.get(queries.mesFat, (e3, mFat) => {
                db.get(queries.mesCusto, (e4, mCusto) => {
                    db.get(queries.mesDespesas, (e5, mDesp) => {
                        db.get(queries.mesRH, (e6, mRH) => {
                            const fat = mFat?.total || 0; 
                            // Agora soma Custos + Despesas + Pagamentos de RH
                            const custos = (mCusto?.total || 0) + (mDesp?.total || 0) + (mRH?.total || 0);
                            res.json({ hoje: { qtd: hoje.qtd || 0, total: hoje.total || 0 }, em_andamento: andam.qtd || 0, mes: { faturamento: fat, custos: custos, lucro: fat - custos } });
                        });
                    });
                });
            });
        });
    });
});
app.get('/api/dashboard/graficos', checkAuth, (req, res) => {
    db.all("SELECT date(data_conclusao) as data, SUM(valor_cobrado) as total FROM transacoes WHERE status = 'CONCLUIDO' AND data_conclusao >= date('now', '-7 days') GROUP BY date(data_conclusao) ORDER BY data", (e1, fat) => {
        db.all("SELECT forma_pagamento, COUNT(*) as qtd FROM transacoes WHERE status = 'CONCLUIDO' AND strftime('%Y-%m', data_conclusao) = strftime('%Y-%m', 'now') GROUP BY forma_pagamento", (e2, pgto) => {
            res.json({ faturamento_semanal: fat || [], formas_pagamento: pgto || [] });
        });
    });
});
app.get('/api/relatorios/fechamento-dia', checkAuth, checkAdmin, (req, res) => {
    db.all("SELECT forma_pagamento, COUNT(*) as qtd, SUM(valor_cobrado) as total FROM transacoes WHERE status = 'CONCLUIDO' AND date(data_conclusao) = ? GROUP BY forma_pagamento", [req.query.data], (e1, vendas) => {
        db.all("SELECT descricao, valor FROM despesas WHERE date(data_despesa) = ?", [req.query.data], (e2, despesas) => {
            res.json({ vendas: vendas||[], despesas: despesas||[], resumo: { total_vendas: (vendas||[]).reduce((a,c)=>a+c.total,0), total_dinheiro: (vendas||[]).filter(v=>v.forma_pagamento.toLowerCase()==='dinheiro').reduce((a,c)=>a+c.total,0) - (despesas||[]).reduce((a,c)=>a+c.valor,0) } });
        });
    });
});
app.get('/api/relatorios/fechamento-mes', checkAuth, checkAdmin, (req, res) => {
    db.get("SELECT SUM(valor_cobrado) as faturamento, SUM(custo_servico) as custo_produtos FROM transacoes WHERE status = 'CONCLUIDO' AND strftime('%Y-%m', data_conclusao) = ?", [req.query.mes], (e1, t) => {
        db.get("SELECT SUM(valor) as total_despesas FROM despesas WHERE strftime('%Y-%m', data_despesa) = ?", [req.query.mes], (e2, d) => {
            db.get("SELECT SUM(valor) as total_rh FROM rh_eventos WHERE tipo = 'DEBITO' AND strftime('%Y-%m', data_evento) = ?", [req.query.mes], (e3, rh) => {
                const fat = t?.faturamento || 0; 
                const cProd = t?.custo_produtos || 0; 
                // Soma as despesas normais com os pagamentos de RH
                const cDesp = (d?.total_despesas || 0) + (rh?.total_rh || 0);
                res.json({ faturamento: fat, custo_produtos: cProd, total_despesas: cDesp, lucro_liquido: fat - cProd - cDesp });
            });
        });
    });
});

// ================== CRUDS (CLIENTES, EXTRATO, SERVIÇOS, ETC) ==================
app.get('/api/buscar-placa/:placa', checkAuth, (req, res) => {
    db.get("SELECT v.modelo, c.nome, c.telefone FROM veiculos v JOIN clientes c ON v.cliente_id = c.id WHERE v.placa = ?", [req.params.placa], (err, row) => res.json(row || null));
});
app.get('/api/clientes/autocomplete', checkAuth, (req, res) => {
    const q = `%${req.query.q}%`;
    db.all("SELECT id, nome, telefone FROM clientes WHERE nome LIKE ? LIMIT 10", [q], (err, clientes) => {
        if(err) return res.json([]);
        let result = [];
        let count = 0;
        if(clientes.length === 0) return res.json([]);
        clientes.forEach(c => {
            db.all("SELECT placa, modelo FROM veiculos WHERE cliente_id = ?", [c.id], (e, veiculos) => {
                result.push({ ...c, veiculos: veiculos || [] });
                count++;
                if (count === clientes.length) res.json(result);
            });
        });
    });
});
app.get('/api/clientes', checkAuth, (req, res) => {
    db.all("SELECT c.id, c.nome, c.telefone, GROUP_CONCAT(v.placa, ', ') as veiculos_info FROM clientes c LEFT JOIN veiculos v ON c.id = v.cliente_id GROUP BY c.id ORDER BY c.nome", (err, rows) => res.json(rows || []));
});
app.post('/api/clientes', checkAuth, (req, res) => {
    db.run("INSERT INTO clientes (nome, telefone) VALUES (?, ?)", [req.body.nome, req.body.telefone], () => res.json({success:true}));
});
app.get('/api/clientes/:id/detalhes', checkAuth, (req, res) => {
    db.get("SELECT * FROM clientes WHERE id = ?", [req.params.id], (err, cliente) => {
        db.all("SELECT * FROM veiculos WHERE cliente_id = ?", [req.params.id], (e, veiculos) => res.json({ ...cliente, veiculos }));
    });
});
app.put('/api/clientes/:id', checkAuth, (req, res) => { db.run("UPDATE clientes SET nome=?, telefone=? WHERE id=?", [req.body.nome, req.body.telefone, req.params.id], () => res.json({success:true})); });

// Rota para Excluir um Cliente (Forçada - Limpa dependências)
app.delete('/api/clientes/:id', checkAuth, (req, res) => {
    const id = req.params.id;
    db.serialize(() => {
        // CORREÇÃO: Limpar todas as dependências do cliente antes de excluí-lo
        db.run("DELETE FROM transacoes WHERE cliente_id = ?", [id]);
        db.run("DELETE FROM agendamentos WHERE cliente_id = ?", [id]);
        db.run("DELETE FROM veiculos WHERE cliente_id = ?", [id]);
        
        // Depois apaga o próprio cliente
        db.run("DELETE FROM clientes WHERE id = ?", [id], (err) => {
            if(err) return res.status(500).json({error: err.message});
            res.json({success: true});
        });
    });
});

app.post('/api/veiculos', checkAuth, (req, res) => { db.run("INSERT INTO veiculos (placa, modelo, cliente_id) VALUES (?,?,?)", [req.body.placa, req.body.modelo, req.body.cliente_id], () => res.json({success:true})); });
app.delete('/api/veiculos/:id', checkAuth, (req, res) => { db.run("DELETE FROM veiculos WHERE id=?", [req.params.id], () => res.json({success:true})); });

app.get('/api/extrato', checkAuth, (req, res) => {
    const mes = req.query.mes;
    let query = "SELECT t.id, t.placa_registrada, v.modelo, c.nome as cliente, s.nome as servico, t.valor_cobrado, t.status, t.forma_pagamento, t.data_hora FROM transacoes t LEFT JOIN clientes c ON t.cliente_id = c.id LEFT JOIN servicos s ON t.servico_id = s.id LEFT JOIN veiculos v ON t.veiculo_id = v.id ";
    let params = [];
    
    if (mes) {
        query += "WHERE t.data_hora LIKE ? ";
        params.push(mes + '%');
    }
    
    query += "ORDER BY t.data_hora DESC LIMIT 300";
    
    db.all(query, params, (err, rows) => {
        if (err) return res.json([]);
        res.json(rows || []);
    });
});
app.put('/api/transacoes/:id', checkAuth, checkAdmin, (req, res) => { db.run("UPDATE transacoes SET valor_cobrado=?, forma_pagamento=? WHERE id=?", [req.body.valor_cobrado, req.body.forma_pagamento, req.params.id], () => res.json({success:true})); });
app.delete('/api/transacoes/:id', checkAuth, checkAdmin, (req, res) => { db.run("DELETE FROM transacoes WHERE id=?", [req.params.id], () => res.json({success:true})); });

app.get('/api/servicos', checkAuth, (req, res) => { db.all("SELECT * FROM servicos ORDER BY nome", (err, rows) => res.json(rows||[])); });
app.post('/api/servicos', checkAuth, checkAdmin, (req, res) => { db.run("INSERT INTO servicos (nome, preco, custo) VALUES (?, ?, ?)", [req.body.nome, req.body.preco, req.body.custo], () => res.json({success:true})); });
app.put('/api/servicos/:id', checkAuth, checkAdmin, (req, res) => { db.run("UPDATE servicos SET nome=?, preco=?, custo=? WHERE id=?", [req.body.nome, req.body.preco, req.body.custo, req.params.id], () => res.json({success:true})); });
app.delete('/api/servicos/:id', checkAuth, checkAdmin, (req, res) => { db.run("DELETE FROM servicos WHERE id=?", [req.params.id], () => res.json({success:true})); });

app.get('/api/funcionarios', checkAuth, (req, res) => { db.all("SELECT * FROM funcionarios ORDER BY nome", (err, rows) => res.json(rows||[])); });
app.post('/api/funcionarios', checkAuth, checkAdmin, (req, res) => { db.run("INSERT INTO funcionarios (nome) VALUES (?)", [req.body.nome], () => res.json({success:true})); });
app.put('/api/funcionarios/:id', checkAuth, checkAdmin, (req, res) => { db.run("UPDATE funcionarios SET nome=? WHERE id=?", [req.body.nome, req.params.id], () => res.json({success:true})); });
app.delete('/api/funcionarios/:id', checkAuth, checkAdmin, (req, res) => { db.run("DELETE FROM funcionarios WHERE id=?", [req.params.id], () => res.json({success:true})); });

app.get('/api/despesas', checkAuth, checkAdmin, (req, res) => { db.all("SELECT * FROM despesas ORDER BY data_despesa DESC", (err, rows) => res.json(rows||[])); });
app.post('/api/despesas', checkAuth, checkAdmin, (req, res) => { db.run("INSERT INTO despesas (descricao, valor, categoria) VALUES (?, ?, ?)", [req.body.descricao, req.body.valor, req.body.categoria], () => res.json({success:true})); });
app.put('/api/despesas/:id', checkAuth, checkAdmin, (req, res) => { db.run("UPDATE despesas SET descricao=?, valor=?, categoria=? WHERE id=?", [req.body.descricao, req.body.valor, req.body.categoria, req.params.id], () => res.json({success:true})); });
app.delete('/api/despesas/:id', checkAuth, checkAdmin, (req, res) => { db.run("DELETE FROM despesas WHERE id=?", [req.params.id], () => res.json({success:true})); });

// ================== USUÁRIOS & RH ==================
app.get('/api/usuarios', checkAuth, checkAdmin, (req, res) => { db.all("SELECT id, login, perfil FROM usuarios", (err, rows) => res.json(rows||[])); });
app.post('/api/usuarios', checkAuth, checkAdmin, async (req, res) => {
    const hash = await bcrypt.hash(req.body.senha, 10);
    db.run("INSERT INTO usuarios (login, senha, perfil) VALUES (?, ?, ?)", [req.body.login, hash, req.body.perfil], (err) => {
        if(err) return res.status(500).json({error: err.message}); res.json({success:true});
    });
});
app.delete('/api/usuarios/:id', checkAuth, checkAdmin, (req, res) => {
    if(req.session.userId == req.params.id) return res.status(400).json({error: 'Não pode excluir a si mesmo'});
    db.run("DELETE FROM usuarios WHERE id = ?", [req.params.id], () => res.json({success:true}));
});

app.post('/api/rh', checkAuth, checkAdmin, (req, res) => {
    db.run("INSERT INTO rh_eventos (funcionario_id, tipo, descricao, valor, data_evento) VALUES (?, ?, ?, ?, ?)", 
    [req.body.funcionario_id, req.body.tipo, req.body.descricao, req.body.valor, req.body.data_evento], (e) => { if(e) res.status(500).json({error: e.message}); else res.json({success:true}); });
});
app.get('/api/rh/saldos', checkAuth, checkAdmin, (req, res) => {
    db.all(`SELECT f.id, f.nome, SUM(CASE WHEN r.tipo='CREDITO' THEN r.valor ELSE 0 END) as creditos, SUM(CASE WHEN r.tipo='DEBITO' THEN r.valor ELSE 0 END) as debitos FROM funcionarios f LEFT JOIN rh_eventos r ON f.id = r.funcionario_id AND strftime('%Y-%m', r.data_evento) = ? GROUP BY f.id`, [req.query.mes], (e, rows) => res.json(rows || []));
});
app.get('/api/rh/extrato', checkAuth, checkAdmin, (req, res) => {
    db.all(`SELECT r.id, r.tipo, r.descricao, r.valor, r.data_evento, f.nome as funcionario FROM rh_eventos r JOIN funcionarios f ON r.funcionario_id = f.id WHERE strftime('%Y-%m', r.data_evento) = ? ORDER BY r.data_evento DESC`, [req.query.mes], (e, rows) => res.json(rows || []));
});
app.delete('/api/rh/:id', checkAuth, checkAdmin, (req, res) => { db.run("DELETE FROM rh_eventos WHERE id=?", [req.params.id], () => res.json({success:true})); });

// ================== ROTA DE EMERGÊNCIA ==================
app.get('/api/limpar-fantasmas', (req, res) => {
    // Essa rota procura e deleta qualquer carro "Em andamento" que tenha perdido o Cliente ou o Serviço no banco de dados
    db.run(`DELETE FROM transacoes WHERE status = 'ANDAMENTO' AND (cliente_id NOT IN (SELECT id FROM clientes) OR servico_id NOT IN (SELECT id FROM servicos))`, (err) => {
        if(err) return res.send("Erro: " + err.message);
        
        res.send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h1 style="color: #10b981;">✨ Limpeza Concluída!</h1>
                <p>Os carros fantasmas foram removidos do seu pátio com sucesso.</p>
                <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Voltar para o Sistema</a>
            </div>
        `);
    });
});

// ================== REDE LOCAL ==================
app.get('/api/rede', (req, res) => {
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    
    for (let name of Object.keys(interfaces)) {
        for (let iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
            }
        }
    }
    res.json({ ip: localIp, porta: 3000 });
});
// ================== START SERVER ==================
const PORT = 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend rodando na porta ${PORT}`);
    
    // Identifica o IP local (IPv4) da sua máquina na rede Wi-Fi/Cabo
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';
    
    for (let name of Object.keys(interfaces)) {
        for (let iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
            }
        }
    }
    
    console.log(`\n=================================================`);
    console.log(`🌐 ACESSO PELA REDE LOCAL (Celular, Tablet, etc)`);
    console.log(`Abra o navegador no outro aparelho e digite:`);
    console.log(`➡️  http://${localIp}:${PORT}`);
    console.log(`=================================================\n`);
});
