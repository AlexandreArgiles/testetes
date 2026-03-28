import db from './database.js';
import bcrypt from 'bcryptjs';

async function resetAdmin() {
    const hash = await bcrypt.hash('admin123', 10);
    db.run("INSERT OR REPLACE INTO usuarios (id, login, senha, perfil) VALUES (1, 'admin', ?, 'admin')", [hash], (err) => {
        if (err) console.log("Erro:", err.message);
        else console.log("✅ Usuário 'admin' pronto! Senha: admin123");
        process.exit();
    });
}
resetAdmin();
