import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Força o Windows a chamar o programa de "SpumaCar" nas notificações
app.setAppUserModelId("SpumaCar");

app.disableHardwareAcceleration();

// Configura o caminho do banco de dados para a pasta de dados do usuário (AppData)
// Isso evita erros de permissão quando o app estiver instalado em "Arquivos de Programas"
const userDataPath = app.getPath('userData');
process.env.DB_PATH = path.join(userDataPath, 'lavajato.db');
process.env.PUBLIC_PATH = path.join(app.getAppPath(), 'public');

console.log('Caminho do AppData configurado para:', process.env.DB_PATH);

import './server.js';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        icon: path.join(app.getAppPath(), 'public/favicon.ico'), 
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // 1. ARRANCANDO O MENU PELA RAIZ (Evita que a tecla ALT roube o teclado)
    mainWindow.setMenu(null);

    // Carregar a URL do servidor local
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 1000);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
