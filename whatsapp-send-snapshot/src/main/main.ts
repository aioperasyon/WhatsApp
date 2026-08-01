import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase } from './database/database.js';
import { registerCoreIpcHandlers } from './ipc/register-core-ipc.js';
import { registerInboxIpc } from './ipc/register-inbox-ipc.js';
import { bootstrapApplication } from './services/bootstrap.service.js';
import {
  getInboxService,
  shutdownInboxServices,
} from './services/inbox-container.service.js';
import { closeAllWhatsAppConnections } from './services/whatsapp-connection.service.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

let mainWindow: BrowserWindow | null = null;
let applicationShuttingDown = false;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#07111f',
    title: 'AI Operasyon WhatsApp CRM',
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.NODE_ENV === 'development') {
    void mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    void mainWindow.loadFile(
      path.join(currentDirectory, '../../renderer/index.html'),
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

void app.whenReady().then(() => {
  const bootstrapResult = bootstrapApplication();

  console.log(
    `[bootstrap] databaseReady=${bootstrapResult.databaseReady} schemaVersion=${bootstrapResult.schemaVersion}`,
  );

  registerCoreIpcHandlers();
  registerInboxIpc(getInboxService());
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  if (applicationShuttingDown) {
    return;
  }

  applicationShuttingDown = true;
  shutdownInboxServices();
  void closeAllWhatsAppConnections();
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
