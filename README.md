# changeset-sparql
Applies a changeset via SPARQL Update

```
npm install changeset-sparql
```

#### Usage: 


First we make a changeset:

```
const EX = 'http://example.info/'
const changeset = {
    // date 
     created: new Date().toISOString(),
    // an array of triples to add
     add: [{s: EX+'123', p: EX+'count', o_value: 0, o_type:'literal', o_datatype: EX+'integer'}]
    // triples to remove (changeset will fail if they don't exist)
   , remove: [{s: EX+'987', p: EX+'message',  o_value: "Hello", o_type:'literal', o_lang: 'en-gb'}]
    // triples to create (changeset will fail if s & p already exist)
   , create: [{s: EX+'987', p: EX+'link',  o_value: EX+"678", o_type:'uri'}],
}
```

Now we define two functions, one to do SPARQL queries, and one to do SPARQL updates. 

Each function should take two arguments: a query/update and a "Node-style" (`(err, data)=>`) callback

```
const request = require('request')

const endpoint = 'http://localhost:3030/TestData'

const query = (q, callback) => request({
    url: endpoint+'/sparql',
    body: q,
    method: 'POST',
    headers: {
        'Accept': 'application/sparql-results+json',
        'Content-type': 'application/sparql-query'
    }
}, (err, data)=> err? callback(err) : callback(null, JSON.parse(data.body)))

const update = (q, callback) => request({
    url: endpoint+'/update',
    body: q,
    method: 'POST',
    headers: {
        'Accept': 'application/sparql-results+json',
        'Content-type': 'application/sparql-update'
    }
}, callback)

```

Now we pass those functions to `applyChangset`, and get back a function that accepts a changeset, and a dictionary of callbacks:

```
const applyChangset = require('changeset-sparql')(query, update)
```

```
applyChangset(changeset, {
    error: console.error,
    ok: console.log,
    rejected: console.error
})

```
