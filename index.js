const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const electronPath = require('electron')
const builder = require('electron-builder')
const webpack = require('webpack')

module.exports = (api, options) => {
  api.registerCommand('electron:serve', async args => {
    const webpackConfig = api.resolveWebpackConfig()
    const compiler = webpack(webpackConfig)
    let child_process
    compiler.hooks.shutdown.tap('vue-cli-service serve', msg => {
      error(msg)
      child_process.kill()
    })

    await api.service.run('serve', args).then(res => {
      const env = Object.assign(process.env, {
        VUE_DEV_SERVER_HOST: res.url
      })

      child_process = spawn(electronPath, ['.'], { stdio: 'inherit', env }).on('error', (err) => {
        console.log(err)
      }).on('close', () => {
        process.exit(1)
      })
    })
  })

  api.registerCommand('electron:build', async args => {

    await api.service.run('build', args).then(() => {
      buildApp()
    })
  })
}

const buildApp = () => {
  /* #region Copy package.json */

  const pkgContent = fs.readFileSync('./package.json', 'utf-8')
  let pkg = JSON.parse(pkgContent)
  const main = pkg.main
  pkg.main = 'background.js'
  pkg.dependencies = {}
  pkg.devDependencies = {}

  const userBuildConfig = pkg.build
  delete pkg.build
  delete pkg.vuePlugins

  const electronPkg = path.join(process.env.VUE_OUTOUT_DIR, '/package.json')
  const electronPkgLock = path.join(process.env.VUE_OUTOUT_DIR, '/package-lock.json')
  fs.appendFileSync(electronPkg, JSON.stringify(pkg, null, 2), 'utf-8')

  /* #endregion */

  /* #region Copy electron entry */

  const electronEntry = path.join(process.env.VUE_OUTOUT_DIR, 'background.js')
  fs.copyFileSync(`./${main}`, electronEntry)

  /* #endregion */

  /* #region Build Electron APP */

  const defaultConfig = {
    files: [
      `**`
    ],
    directories: {
      buildResources: 'build',
      output: './dist-electron',
      app: process.env.VUE_OUTOUT_DIR
    },
    extends: null
  }

  builder.build({
    config: Object.assign({}, defaultConfig, userBuildConfig)
  }).then(() => {
    fs.rmSync(electronPkg)
    fs.rmSync(electronPkgLock)
    fs.rmSync(electronEntry)
    console.log('Build Complete !!')
  }).catch(err => {
    console.log(err)
  }).finally(() => {
    process.exit(1)
  })

  /* #endregion */
}

module.exports.defaultModes = {
  'electron:serve': 'dev',
  'electron:build': 'build'
}