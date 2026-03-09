import { app, BrowserWindow, shell, dialog, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { registerIpcHandlers } from './ipc-handlers'

// EPIPE 등 비동기 에러가 앱을 크래시시키지 않도록 전역 핸들러 등록
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    console.warn('[AR-AI] EPIPE suppressed (broken pipe on aborted stream)')
    return
  }
  console.error('[AR-AI] Uncaught Exception:', err)
})

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  if (msg.includes('EPIPE') || msg.includes('aborted')) {
    console.warn('[AR-AI] Unhandled rejection suppressed:', msg)
    return
  }
  console.error('[AR-AI] Unhandled Rejection:', reason)
})

function getIconPath(): string | undefined {
  // 개발 모드: build 폴더에서 아이콘 로드
  if (is.dev) {
    const devIcon = join(__dirname, '../../build/icon.png')
    if (existsSync(devIcon)) return devIcon
  }
  return undefined // 프로덕션: electron-builder가 앱 아이콘을 자동 설정
}

function createWindow(): void {
  const iconPath = getIconPath()

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'AR-AI',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message)
  })

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

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Update check failed:', err.message)
  })
}

app.whenReady().then(() => {
  // macOS Dock 아이콘 설정 (개발 모드에서만 커스텀 아이콘 사용)
  if (process.platform === 'darwin') {
    const iconPath = getIconPath()
    if (iconPath) {
      try {
        const icon = nativeImage.createFromPath(iconPath)
        if (!icon.isEmpty()) app.dock.setIcon(icon)
      } catch {
        // 아이콘 로드 실패 시 기본 아이콘 사용
      }
    }
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
