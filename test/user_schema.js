'use strict'

module.exports = {
  firstName: String,
  middleName: {
    type: String,
    dataSanitizer: { skipAll: true },
    uppercase: true
  },
  lastName: {
    type: String,
    uppercase: true,
    maxLength: 50
  },
  age: Number,
  email: {
    type: String,
    lowercase: true
  },
  hasChildren: Boolean,
  lastSeen: Date,
  favouriteFruits: [ String ],
  phoneNumbers: {
    home: String,
    mobile: { type: String, dataSanitizer: { skipAll: true } }
  },
  addresses: [{
    street: String,
    city: String,
    zipCode: String,
    coordinates: { type: String, dataSanitizer: { skipAll: true } }
  }]
}
