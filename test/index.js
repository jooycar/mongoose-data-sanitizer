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
            email: 's@mith.COM',
            favouriteFruits: [ 'Mango', 'Blackberry', '@PPLE' ],
            phoneNumbers: {
              home: '+138258328584',
              mobile: '+131185645645'
            },
            addresses: [
              { street: 'Main St.', city: 'Atlantis', zipCode: '+MIN(2;3)', coordinates: '+41,-73' },
              { street: 'Boring Av.', city: 'Downtown City', zipCode: '2234', coordinates: '+43,-70' }
            ]
          })

          expect(user).to.deep.include({
            firstName: '\'=HYPERLINK("http://some-evil-server.xyz")', // Matching should be sanitized
            middleName: '=1+1', // SchemaType has skipAll: true
            lastName: 'SMITH', // Non-matching should be unmodified
            email: 's@mith.com',
            favouriteFruits: [ 'Mango', 'Blackberry', '\'@PPLE' ]
          })

          expect(user.phoneNumbers).to.include({
            home: '\'+138258328584',
            mobile: '+131185645645'
          })

          const { addresses } = user.toJSON()
          expect(addresses).to.have.length(2)
          const expectedAddresses = [
            { street: 'Main St.', city: 'Atlantis', zipCode: '\'+MIN(2;3)', coordinates: '+41,-73' },
            { street: 'Boring Av.', city: 'Downtown City', zipCode: '2234', coordinates: '+43,-70' }
          ]
          addresses.forEach((a, idx) => expect(a).to.deep.include(expectedAddresses[idx]))
        })
      })

      describe('enabled validator', function() {
        let User

        before(function() {
          const userSchema = new mongoose.Schema(userSchemaDef)
          userSchema.plugin(dataSanitizerPlugin, { builtInValidators: [ 'csv-injection' ] })
          User = mongoose.model('UserCSVSafe', userSchema)
        })

        it('should trigger if data matches CSV malicious value (base)', async function() {
          await expect(User.create({
            firstName: '=HYPERLINK("http://some-evil-server.xyz")',
            lastName: 'Smith'
          })).to.eventually.be.rejectedWith(mongoose.Error.ValidationError, /firstName\: \[CSV\] Invalid character in string/)
        })

        it('should trigger if data matches CSV malicious value (array)', async function() {
          await expect(User.create({
            firstName: 'Agent',
            lastName: 'Smith',
            favouriteFruits: [ 'Mango', 'Blackberry', '@PPLE' ]
          })).to.eventually.be.rejectedWith(mongoose.Error.ValidationError, /favouriteFruits\: \[CSV\] Invalid character in string/)
        })

        it('should trigger if data matches CSV malicious value (nested)', async function() {
          await expect(User.create({
            firstName: 'Agent',
            lastName: 'Smith',
            phoneNumbers: {
              home: '+138258328584',
              mobile: '+131185645645'
            }
          })).to.eventually.be.rejectedWith(mongoose.Error.ValidationError, /phoneNumbers\.home\: \[CSV\] Invalid character in string/)
        })

        it('should trigger if data matches CSV malicious value (implicit document array)', async function() {
          await expect(User.create({
            firstName: 'Agent',
            lastName: 'Smith',
            addresses: [
              { street: 'Main St.', city: 'Atlantis', zipCode: '+MIN(2;3)', coordinates: '+41,-73' },
              { street: 'Boring Av.', city: 'Downtown City', zipCode: '2234', coordinates: '+43,-70' }
            ]
          })).to.eventually.be.rejectedWith(mongoose.Error.ValidationError, /addresses\.0\.zipCode\: \[CSV\] Invalid character in string/)
        })

        it('should not trigger if attribute has skipAll: true', async function() {
          await expect(User.create({
            middleName: '+ROUND()',
            lastName: 'Smith',
            addresses: [
              { street: 'Main St.', city: 'Atlantis', zipCode: '3423', coordinates: '+41,-73' },
              { street: 'Boring Av.', city: 'Downtown City', zipCode: '2234', coordinates: '+43,-70' }
            ]
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
            middleName: '+ROUND()',
            lastName: 'Smith',
            favouriteFruits: [ 'Mango', 'Blackberry', '@PPLE' ],
            phoneNumbers: {
              home: '+138258328584',
              mobile: '+131185645645'
            }
          })).to.eventually.be.fulfilled
        })

        it('should not trigger if data is clean', async function() {
          await expect(User.create({
            firstName: 'Agent',
            middleName: 'A.',
            lastName: 'Smith',
            favouriteFruits: [ 'Mango', 'Blackberry', 'Avocado' ],
            phoneNumbers: {
              home: '138258328584',
              mobile: '131185645645'
            },
            addresses: [
              { street: 'Main St.', city: 'Atlantis', zipCode: '4534', coordinates: '41,-73' },
              { street: 'Boring Av.', city: 'Downtown City', zipCode: '2234', coordinates: '43,-70' }
            ]
          })).to.eventually.be.fulfilled
        })
      })
    })
  })
})
