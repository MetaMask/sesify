const { runInNewContext } = require('vm')
const browserify = require('browserify')
const pify = require('pify')
const clone = require('clone')
const through2 = require('through2').obj
const mergeDeep = require('merge-deep')
// our special async tape
const test = require('tape-promise').default(require('tape'))

const sesifyPlugin = require('../src/index')


module.exports = {
  getTape,
  createBundleFromEntry,
  createBundleFromRequiresArray,
  createBundleFromRequiresArrayPath,
  generateConfigFromFiles,
  filesToConfigSource,
  fnToCodeBlock,
  testEntryAttackerVictim,
  runSimpleOneTwo,
  runSimpleOneTwoSamePackage,
  evalBundle,
}

function getTape () {
  return test
}

async function createBundleFromEntry (path, pluginOpts = {}) {
  pluginOpts.config = pluginOpts.config || {}
  const bundler = browserify([], sesifyPlugin.args)
  bundler.add(path)
  bundler.plugin(sesifyPlugin, pluginOpts)
  return bundleAsync(bundler)
}

async function createBundleFromRequiresArrayPath (path, pluginOpts) {
  const depsArray = require(path)
  return createBundleFromRequiresArray(depsArray, pluginOpts)
}

async function createBundleFromRequiresArray (files, pluginOpts) {
  const bundler = createBrowserifyFromRequiresArray({ files, pluginOpts })
  return bundleAsync(bundler)
}

function createBrowserifyFromRequiresArray ({ files, pluginOpts = {} }) {
  // empty bundle but inject modules at bundle time
  const bifyOpts = Object.assign({}, sesifyPlugin.args)
  pluginOpts.config = pluginOpts.config || {}
  const bundler = browserify([], bifyOpts)
  bundler.plugin(sesifyPlugin, pluginOpts)

  // override browserify's module resolution
  const mdeps = bundler.pipeline.get('deps').get(0)
  mdeps.resolve = (id, parent, cb) => {
    const parentModule = files.find(f => f.id === parent.id)
    const moduleId = parentModule ? parentModule.deps[id] : id
    const moduleData = files.find(f => f.id === moduleId)
    if (!moduleData) {
      throw new Error(`could not find "${moduleId}" in files:\n${files.map(f => f.id).join('\n')}`)
    }
    const file = moduleData.file
    const pkg = null
    const fakePath = moduleData.file
    cb(null, file, pkg, fakePath)
  }

  // inject files into browserify pipeline
  const fileInjectionStream = through2(null, null, function (cb) {
    clone(files).reverse().forEach(file => {
      // must explicitly specify entry field
      file.entry = file.entry || false
      this.push(file)
    })
    cb()
  })
  bundler.pipeline.splice('record', 0, fileInjectionStream)

  return bundler
}

async function generateConfigFromFiles ({ files }) {
  const configSource = await filesToConfigSource({ files })
  const config = JSON.parse(configSource)
  return config
}

async function filesToConfigSource ({ files }) {
  let pluginOpts
  const promise = new Promise((resolve) => {
    pluginOpts = { writeAutoConfig: resolve }
  })

  const bundler = createBrowserifyFromRequiresArray({ files, pluginOpts })
  await bundleAsync(bundler)
  const configSource = await promise
  return configSource
}

async function bundleAsync (bundler) {
  const src = await pify(cb => bundler.bundle(cb))()
  return src.toString()
}

function fnToCodeBlock (fn) {
  return fn.toString().split('\n').slice(1,-1).join('\n')
}


async function testEntryAttackerVictim (t, { defineAttacker, defineVictim }) {

  function defineEntry () {
    require('attacker')
    const result = require('victim').action()
    global.testResult = result
  }

  const depsArray = [
    {
      'id': '/entry.js',
      'file': '/entry.js',
      'source': `(${defineEntry}).call(this)`,
      'deps': {
        'attacker': '/node_modules/attacker/index.js',
        'victim': '/node_modules/victim/index.js'
      },
      'entry': true
    },
    {
      'id': '/node_modules/attacker/index.js',
      'file': '/node_modules/attacker/index.js',
      'source': `(${defineAttacker}).call(this)`,
      'deps': {
        'victim': '/node_modules/victim/index.js'
      }
    },
    {
      'id': '/node_modules/victim/index.js',
      'file': '/node_modules/victim/index.js',
      'source': `(${defineVictim}).call(this)`,
      'deps': {}
    }
  ]

  const config = {
    "resources": {
      "<root>": {
        "packages": {
          "attacker": true,
          "victim": true,
        }
      },
      "attacker": {
        "packages": {
          "victim": true,
        }
      },
    }
  }
  const bundle = await createBundleFromRequiresArray(depsArray, { config })
  const result = evalBundle(bundle)
  t.equal(result, false)
}

async function runSimpleOneTwo ({ defineOne, defineTwo, config = {}, testGlobal }) {

  function defineEntry () {
    global.testResult = require('one')
  }

  const depsArray = [
    {
      'id': '/entry.js',
      'file': '/entry.js',
      'source': `(${defineEntry}).call(this)`,
      'deps': {
        'one': '/node_modules/one/index.js',
        'two': '/node_modules/two/index.js'
      },
      'entry': true
    },
    {
      'id': '/node_modules/one/index.js',
      'file': '/node_modules/one/index.js',
      'source': `(${defineOne}).call(this)`,
      'deps': {
        'two': '/node_modules/two/index.js'
      }
    },
    {
      'id': '/node_modules/two/index.js',
      'file': '/node_modules/two/index.js',
      'source': `(${defineTwo}).call(this)`,
      'deps': {}
    }
  ]

  const _config = mergeDeep({
    "resources": {
      "<root>": {
        "packages": {
          "one": true,
        }
      },
      "one": {
        "packages": {
          "two": true,
        }
      },
    }
  }, config)

  const bundle = await createBundleFromRequiresArray(depsArray, { config: _config })
  const result = evalBundle(bundle, testGlobal)

  return result
}

async function runSimpleOneTwoSamePackage({ defineOne, defineTwo, config = {}, testGlobal }) {

  function defineEntry() {
    global.testResult = require('one')
  }

  const depsArray = [
    {
      'id': '/entry.js',
      'file': '/entry.js',
      'source': `(${defineEntry}).call(this)`,
      'deps': {
        'one': '/node_modules/one/index.js',
        'two': '/node_modules/one/main.js'
      },
      'entry': true
    },
    {
      'id': '/node_modules/one/index.js',
      'file': '/node_modules/one/index.js',
      'source': `(${defineOne}).call(this)`,
      'deps': {
        'two': '/node_modules/one/main.js'
      }
    },
    {
      'id': '/node_modules/one/main.js',
      'file': '/node_modules/one/main.js',
      'source': `(${defineTwo}).call(this)`,
      'deps': {}
    }
  ]

  const _config = mergeDeep({
    "resources": {
      "<root>": {
        "packages": {
          "one": true,
        }
      },
      "one": {
        "packages": {
          "two": true,
        }
      },
    }
  }, config)

  const bundle = await createBundleFromRequiresArray(depsArray, { config: _config })
  const result = evalBundle(bundle, testGlobal)

  return result
}

function evalBundle (bundle, context) {
  const newContext = Object.assign({}, {
    // whitelisted require fn (used by SES)
    require: (modulePath) => {
      if (modulePath === 'vm') return require('vm')
      throw new Error(`Lavamoat bundle called "require" with modulePath not in the whitelist: "${modulePath}"`)
    },
    // test-provided context
  }, context)
  // circular ref (used by SES)
  newContext.global = newContext
  // perform eval
  runInNewContext(bundle, newContext)
  // pull out test result value from context (not always used)
  return newContext.testResult
}