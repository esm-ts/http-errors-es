const assert = require('assert')
const createError = require('..')
const fs = require('fs')
const path = require('path')
const util = require('util')

const README_PATH = path.join(__dirname, '..', 'README.md')
const README_CONTENTS = fs.readFileSync(README_PATH, 'utf-8')

Object.keys(createError).forEach(function (key) {
  if (!isNaN(key)) {
    return
  }

  const constructor = createError[key]
  const statusCode = constructor.prototype.statusCode

  if (createError[statusCode] !== constructor) {
    return
  }

  const regexp = new RegExp(util.format('^\\|%d\\s*\\|%s\\s*\\|$', statusCode, key), 'm')

  assert.ok(regexp.test(README_CONTENTS),
    util.format('README constructor list contains %d %s', statusCode, key))
})
