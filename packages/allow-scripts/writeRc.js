const { existsSync, writeFileSync, createWriteStream, promises: { readFile } } = require('fs')

const RCENTRY = 'ignore-scripts true'
const isYarn = existsSync('./yarn.lock')
const isNpm = existsSync('./package-lock.json')
const yarnRcExists = existsSync('./.yarnrc')
const npmRcExists = existsSync('./.npmrc')

let rcFile
if (isYarn) {
  rcFile = './.yarnrc'
} else if (isNpm) {
  rcFile = './.npmrc'
} else {
  rcFile = './.yarnrc'
}


async function writeRcFile () {
  if (!yarnRcExists && !npmRcExists) {
    writeFileSync(rcFile, RCENTRY)
    console.log(`@lavamoat/allow-scripts: created ${rcFile.split('/')[1]} file with entry: ignore-scripts true. Run \'yarn add -D @lavamoat/preinstall-always-fail\' to make sure this configuration is correct.`)
    return
  } else {
    const rcFileContents = await readFile(rcFile, 'utf8')
    if (rcFileContents.includes(RCENTRY)) {
      return
    }
    const rcStream = createWriteStream(rcFile, { flags:'a' });
    if (rcFileContents.length) {
      rcStream.write('\n' + RCENTRY)
    } else {
      rcStream.write(RCENTRY)
    }
    console.log(`@lavamoat/allow-scripts: added entry to ${rcFile.split('/')[1]}: ignore-scripts true. Run \'yarn add -D @lavamoat/preinstall-always-fail\' to make sure this configuration is correct.`)
  }
}

writeRcFile()