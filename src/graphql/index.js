const reporteMedicoSchema = require('./schemas/reporteMedico');
const reporteMedicoResolvers = require('./resolvers/reporteMedico');

module.exports = {
  typeDefs: [reporteMedicoSchema],
  resolvers: [reporteMedicoResolvers],
};