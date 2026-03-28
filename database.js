import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlite = sqlite3.verbose();

// Define o caminho para o arquivo database.db
// Se estiver rodando no Electron (produção), usa o AppData. Senão, usa a pasta atual.
const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'lavajato.db');

console.log('------------------------------------------------');
console.log('📂 BANCO DE DADOS ATIVO EM:', dbPath);
console.log('------------------------------------------------');

const db = new sqlite.Database(dbPath, (err) => {
    if (err) console.error('❌ Erro DB:', err.message);
    else console.log('✅ Banco de dados conectado com sucesso.');
});

db.serialize(() => {
    // Criação das tabelas essenciais
    db.run(`CREATE TABLE IF NOT EXISTS servicos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, preco REAL NOT NULL, custo REAL DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS funcionarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, telefone TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS veiculos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, placa TEXT NOT NULL UNIQUE, modelo TEXT, cliente_id INTEGER,
        FOREIGN KEY(cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER, veiculo_id INTEGER, placa_registrada TEXT,
        funcionario_id INTEGER, servico_id INTEGER, valor_cobrado REAL, custo_servico REAL, forma_pagamento TEXT,
        status TEXT DEFAULT 'ANDAMENTO', data_hora DATETIME DEFAULT CURRENT_TIMESTAMP, data_conclusao DATETIME,
        obs TEXT, servico_extra TEXT, valor_extra REAL DEFAULT 0,
        FOREIGN KEY(cliente_id) REFERENCES clientes(id), FOREIGN KEY(veiculo_id) REFERENCES veiculos(id),
        FOREIGN KEY(funcionario_id) REFERENCES funcionarios(id), FOREIGN KEY(servico_id) REFERENCES servicos(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, cliente_id INTEGER, veiculo_id INTEGER, servico_id INTEGER,
        data_agendada DATETIME NOT NULL, obs TEXT, status TEXT DEFAULT 'PENDENTE', servico_extra TEXT, valor_extra REAL DEFAULT 0,
        FOREIGN KEY(cliente_id) REFERENCES clientes(id), FOREIGN KEY(veiculo_id) REFERENCES veiculos(id),
        FOREIGN KEY(servico_id) REFERENCES servicos(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT NOT NULL UNIQUE, senha TEXT NOT NULL, perfil TEXT DEFAULT 'operador')`);
    
    db.run(`CREATE TABLE IF NOT EXISTS despesas (id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT NOT NULL, valor REAL NOT NULL, data_despesa DATE DEFAULT CURRENT_DATE, categoria TEXT)`);
    
    db.run(`CREATE TABLE IF NOT EXISTS rh_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, funcionario_id INTEGER, tipo TEXT NOT NULL, descricao TEXT, valor REAL NOT NULL, data_evento DATE DEFAULT CURRENT_DATE,
        FOREIGN KEY(funcionario_id) REFERENCES funcionarios(id)
    )`);
});

export default db;
