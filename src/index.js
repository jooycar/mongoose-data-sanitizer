'use strict'

const builtInDefs = require('./builtin')

function buildArr(builtInAttr, builtIn, custom) {
  return builtIn
    .map(v => builtInDefs[v][builtInAttr])
    .filter(_ => _)
    .concat(custom)
}

function buildValidator(schemaType, validatorArgs) {
  const [ fn, errorMsg ] = validatorArgs

  if (isStringSchemaArray(schemaType))
    return [ function (value) { return value.every(fn) }, errorMsg ]

  return validatorArgs
}

function isImplicitDocumentArraySchema(schemaType) {
  return schemaType.instance === 'Array'
    && schemaType['$isMongooseDocumentArray'] === true
    && schemaType.schema['$implicitlyCreated'] === true
}

function isStringSchemaArray(schemaType) {
  return schemaType.instance === 'Array' && schemaType.caster.instance === 'String'
}

function isSchemaString(schemaType) {
  return schemaType.instance === 'String'
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
        if (isSchemaString(schemaType) || isStringSchemaArray(schemaType) || isImplicitDocumentArraySchema(schemaType))
          m.push(schemaType)
      }
      return m
    }, [])

  pathsToHandle.forEach(schemaType => {
    if (isImplicitDocumentArraySchema(schemaType))
      return sanitizerPlugin(schemaType.schema, options)

    const dataSanitizerOpts = pluginOptsFromOptions(schemaType)

    if (!dataSanitizerOpts.skipSanitizers) {
      const builtInSanitizers = defaultOpt('builtInSanitizers', [], dataSanitizerOpts)
      const customSanitizers = defaultOpt('customSanitizers', [], dataSanitizerOpts)
      const sanitizers = buildArr('sanitizer', builtInSanitizers, customSanitizers)
      const sanitizationSchema = isStringSchemaArray(schemaType) ? schemaType.caster : schemaType

      sanitizers.forEach(({ getter, setter }) => {
        if (getter) sanitizationSchema.get(getter)
        if (setter) sanitizationSchema.set(setter)
      })
    }

    if (!dataSanitizerOpts.skipValidators) {
      const builtInValidators = defaultOpt('builtInValidators', [], dataSanitizerOpts)
      const customValidators = defaultOpt('customValidators', [], dataSanitizerOpts)
      const validators = buildArr('validator', builtInValidators, customValidators)

      validators.forEach(validatorArgs => {
        schemaType.validate(...buildValidator(schemaType, validatorArgs))
      })
    }
  })
}

module.exports = sanitizerPlugin
