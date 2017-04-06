const applyChangset = require('./index.js')

const EX = 'http://example.info/'
const changeset = {
    created: new Date().toISOString(),
//    create: [{s: EX+'123', p: EX+'count', o_value: 0, o_type:'literal', o_datatype: EX+'integer'}]
//   , remove: [{s: EX+'987', p: EX+'message',  o_value: "Hello", o_type:'literal', o_lang: 'en-gb'}]
    add: [{s: EX+'987', p: EX+'link',  o_value: EX+"678", o_type:'uri'}],
}



//usage:
// applyChangset(sparqlQueryFunc, sparqlUpdateFunc)
//  (changeset, {
//  error: errorCallback,
//  rejected: changesetRejected,
//  ok: changesetSuccessful
//  })



const request = require('request')
const endpoint = 'http://localhost:3030/TestData'
const sparqlEndpoint = endpoint+'/sparql'
const updateEndpoint = endpoint+'/update'
const query = (q, callback) => request({
    url: sparqlEndpoint,
    body: q,
    method: 'POST',
    headers: {
        'Accept': 'application/sparql-results+json',
        'Content-type': 'application/sparql-query'
    }
}, (err, data)=> err? callback(err) : callback(null, JSON.parse(data.body)))
const updater = (q, callback) => request({
    url: updateEndpoint,
    body: q,
    method: 'POST',
    headers: {
        'Accept': 'application/sparql-results+json',
        'Content-type': 'application/sparql-update'
    }
}, callback)

applyChangset(query, updater)(changeset, {
    error: console.error,
    ok: console.log,
    rejected: console.error
})

