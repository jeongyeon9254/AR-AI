import { app, BrowserWindow, shell, dialog } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { registerIpcHandlers } from './ipc-handlers'

function createWindow(): void {
  const iconPath = is.dev
    ? join(__dirname, '../../build/icon.png')
    : join(__dirname, '../../build/icon.png')

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AR-AI',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  registerIpcHandlers(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupAutoUpdater(): void {
  if (is.dev) return

  autoUpdater.autoDownload = false

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: '업데이트 가능',
        message: `새 버전 ${info.version}이 있습니다. 다운로드하시겠습니까?`,
        buttons: ['다운로드', '나중에']
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate()
        }
      })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: '업데이트 준비 완료',
        message: '업데이트가 다운로드되었습니다. 재시작하여 적용하시겠습니까?',
        buttons: ['재시작', '나중에']
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.checkForUpdates()
}

app.whenReady().then(() => {
  // macOS Dock 아이콘 설정
  if (process.platform === 'darwin') {
    const dockIcon = is.dev
      ? join(__dirname, '../../build/icon.png')
      : join(__dirname, '../../build/icon.png')
    app.dock.setIcon(dockIcon)
  }

  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
