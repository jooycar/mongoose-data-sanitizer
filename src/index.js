'use strict'

const builtInDefs = require('./builtin')

function buildArr(builtInAttr, builtIn, custom) {
  return builtIn
    .map(v => builtInDefs[v][builtInAttr])
    .filter(_ => _)
    .concat(custom)
}

function pluginOptsFromOptions(obj) {
  return (obj.options || {}).dataSanitizer || {}
}

function sanitizerPlugin(schema, options = {}) {
  const schemaSanitizerOpts = pluginOptsFromOptions(schema)

  function defaultOpt(optKey, defaultValue, attrOpts = {}) {
    return attrOpts[optKey] || schemaSanitizerOpts[optKey] || options[optKey] || defaultValue
  }

  const pathsToHandle = Object.entries(schema.paths)
    .reduce((m, e) => {
      const schemaType = e[1]
      const dataSanitizerOpts = pluginOptsFromOptions(schemaType)
      if (!dataSanitizerOpts.skipAll) {
        if (schemaType.instance === 'String')
          m.push(schemaType)
        else if(schemaType.instance === 'Array' && schemaType.caster.instance === 'String')
          m.push(schemaType.caster)
      }
      return m
    }, [])

  pathsToHandle.forEach(schemaType => {
    const dataSanitizerOpts = pluginOptsFromOptions(schemaType)

    if (!dataSanitizerOpts.skipSanitizers) {
      const builtInSanitizers = defaultOpt('builtInSanitizers', [], dataSanitizerOpts)
      const customSanitizers = defaultOpt('customSanitizers', [], dataSanitizerOpts)
      const sanitizers = buildArr('sanitizer', builtInSanitizers, customSanitizers)

      sanitizers.forEach(({ getter, setter }) => {
        if (getter) schemaType.get(getter)
        if (setter) schemaType.set(setter)
      })
    }

    if (!dataSanitizerOpts.skipValidators) {
      const builtInValidators = defaultOpt('builtInValidators', [], dataSanitizerOpts)
      const customValidators = defaultOpt('customValidators', [], dataSanitizerOpts)
      const validators = buildArr('validator', builtInValidators, customValidators)

      validators.forEach(validatorArgs => {
        schemaType.validate(...validatorArgs)
      })
    }
  })
}

module.exports = sanitizerPlugin
