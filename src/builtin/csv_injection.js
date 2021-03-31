'use strict'

function check(value) {
  return !(value && ~[ '=', '+', '-', '@' ].indexOf(value[0]))
}

function sanitize(value) {
  if (!check(value))
    return '\'' + value
  return value
}

module.exports = {
  sanitizer: {
    getter: sanitize,
    setter: sanitize
  },
  validator: [
    check,
    '[CSV] Invalid character in string'
  ]
}
