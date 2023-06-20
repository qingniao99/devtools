// Start middleware server
require('./server')
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
// process.env.ADB_ZIP_CACHE = true
// const adb = require('android-platform-tools')
// const { exec } = require('child_process')
const portfinder = require('portfinder')

const inspect = process.argv.includes('--inspect')

app.commandLine.appendSwitch('disable-site-isolation-trials');

let mainWindow = null
let tmport = null
function setADB (cb) {
  process.env.ADB_ZIP_CACHE = true
  const adb = require('android-platform-tools')
  const { exec } = require('child_process')
  adb
    .downloadAndReturnToolPaths()
    .then((tools) => {
      const adbPath = tools.adbPath
      const platformToolsPath = tools.platformToolsPath
      console.log(adbPath, platformToolsPath, 2222)
      portfinder.getPortPromise().then((port) => {
        // app.commandLine.appendSwitch('remote-debugging-port', port)
        // app.commandLine.appendSwitch('remote-debugging-address', 'http://127.0.0.1')
        cb && cb()
        exec('./adb kill-server', {
          cwd: platformToolsPath,
        }, (error) => {
          if (error) {
            console.log(error)
            mainWindow.webContents.send('notify', { body: error })
            // return
          }
          exec('./adb start-server', {
            cwd: platformToolsPath,
          }, (error) => {
            if (error) {
              console.log(error)
              mainWindow.webContents.send('notify', { body: error })
              // return
            }
            setTimeout(() => {
              exec('./adb shell grep -a webview_devtools_remote /proc/net/unix', {
                cwd: platformToolsPath,
              }, (error, stdout, stderr) => {
                if (error) {
                  console.log(`error: ${error.message}`)
                  mainWindow.webContents.send('notify', { body: error })
                }
                if (stderr) {
                  console.log(`stderr: ${stderr}`)
                  mainWindow.webContents.send('notify', { body: stderr })
                }
                console.log(`stdout: ${stdout}`)
                const dest = stdout.match(/(webview_devtools_remote_\d+)/gi)
                console.log(dest)
                if (dest) {
                  tmport = port
                  exec(`./adb forward tcp:${port} localabstract:${dest}`, {
                    cwd: platformToolsPath,
                  }, (error, stdout, stderr) => {
                    if (error) {
                      console.log(`error: ${error.message}`)
                      mainWindow.webContents.send('notify', { body: error })
                    }
                    if (stderr) {
                      console.log(`stderr: ${stderr}`);
                      mainWindow.webContents.send('notify', { body: stderr })
                    }
                    console.log(`stdout: ${stdout}`)
                    cb()
                  })
                }
              })
            }, 1000)
          })
        })
      })
    })
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: inspect ? 2400 : 1800,
    height: inspect ? 1400 : 1400,
    icon: path.join(__dirname, 'icons/128.png'),
    webPreferences: {
      webSecurity: false,
      allowRunningInsecureContent: true,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })
  // mainWindow.webContents.openDevTools()
  if (inspect) {
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, inspect ? `inspect.html` : 'app.html'),
      protocol: 'file:',
      slashes: true,
    })).then(() => {
      setADB(() => {
        mainWindow.webContents.send('list', tmport)
      })
    })
  } else {
    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, inspect ? 'inspect.html' : 'app.html'),
      protocol: 'file:',
      slashes: true,
    }))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

ipcMain.on('get-msg', (e, msg) => {
  console.log('get-msg:' + msg);
  setADB(() => {
    mainWindow.webContents.send('list2', tmport)
  })
})
