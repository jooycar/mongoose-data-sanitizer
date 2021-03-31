'use strict'

const chai = require('chai')
const { expect } = chai
chai.use(require('chai-as-promised'))

const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

const dataSanitizerPlugin = require('../src/index')
const userSchemaDef = require('./user_schema')

let mongoServer;

before(async () => {
  mongoServer = new MongoMemoryServer()
  const mongoUri = await mongoServer.getUri()
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
})

after(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

describe('mongoose-data-sanitizer', function() {

  describe('built-in', function() {

    describe('csv-injection', function() {

      describe('enabled sanitizer', function() {
        let User

        before(function() {
          const userSchema = new mongoose.Schema(userSchemaDef)
          userSchema.plugin(dataSanitizerPlugin, { builtInSanitizers: [ 'csv-injection' ] })
          User = mongoose.model('UserCSVSanitized', userSchema)
        })

        it('should sanitize data if matches CSV malicious value', async function() {
          const user = await User.create({
            firstName: '=HYPERLINK("http://some-evil-server.xyz")',
            middleName: '=1+1',
            lastName: 'Smith',
            email: 's@mith.COM'
          })

          expect(user).to.include({
            firstName: '\'=HYPERLINK("http://some-evil-server.xyz")', // Matching should be sanitized
            middleName: '=1+1', // SchemaType has skipAll: true
            lastName: 'SMITH', // Non-matching should be unmodified
            email: 's@mith.com'
          })
        })
      })

      describe('enabled validator', function() {
        let User

        before(function() {
          const userSchema = new mongoose.Schema(userSchemaDef)
          userSchema.plugin(dataSanitizerPlugin, { builtInValidators: [ 'csv-injection' ] })
          User = mongoose.model('UserCSVSafe', userSchema)
        })

        it('should trigger if data matches CSV malicious value', async function() {
          await expect(User.create({
            firstName: '=HYPERLINK("http://some-evil-server.xyz")',
            lastName: 'Smith'
          })).to.eventually.be.rejectedWith(mongoose.Error.ValidationError, /firstName\: \[CSV\] Invalid character in string/)
        })

        it('should not trigger if attribute has skipAll: true', async function() {
          await expect(User.create({
            middleName: '+ROUND()',
            lastName: 'Smith'
          })).to.eventually.be.fulfilled
        })

        it('should not trigger if data is clean', async function() {
          await expect(User.create({
            firstName: 'Agent',
            lastName: 'Smith',
            email: 's@mith.COM'
          })).to.eventually.be.fulfilled
        })
      })

      describe('disabled validator', function() {
        let User

        before(function() {
          const userSchema = new mongoose.Schema(userSchemaDef)
          userSchema.plugin(dataSanitizerPlugin)
          User = mongoose.model('UserNonCSVSafe', userSchema)
        })

        it('should not trigger when validator is not enabled', async function() {
          await expect(User.create({
            firstName: '=HYPERLINK("http://some-evil-server.xyz")',
            lastName: 'Smith'
          })).to.eventually.be.fulfilled
        })

        it('should not trigger if data is clean', async function() {
          await expect(User.create({
            firstName: 'Agent',
            lastName: 'Smith'
          })).to.eventually.be.fulfilled
        })
      })
    })
  })
})