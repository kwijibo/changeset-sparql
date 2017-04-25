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
    // an array of triples/quads to add
     add: [{s: EX+'123', p: EX+'count', o_value: 0, o_type:'literal', o_datatype: EX+'integer', g: EX+'graphs/graph-name'}]
    // triples/quads to remove (changeset will fail if they don't exist)
   , remove: [{s: EX+'987', p: EX+'message',  o_value: "Hello", o_type:'literal', o_lang: 'en-gb'}]
    // triples/quads to create (changeset will fail if s & p already exist)
   , previous: ["urn:hash:sha1:jkhjkhkj2kjh3", "urn:hash:sha1:mnwejkljh7898c"],
   // the URIs of the latest changesets for each subject we want to change
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

Now we pass those functions to `changsetSparql`, and get back a function that accepts a changeset, and a dictionary of callbacks:

```
const changsetSparql = require('changeset-sparql')(query, update)
```

```
changsetSparql(changeset, {
    error: console.error,
    rejected: console.error,
    ok: console.log
})

```
- `error` Gets called with an error if there are problems running the updates or queries (ie: if `query` or `update` call the callback with an error). You may want to retry if this happens.
- `rejected` gets called with an error message if the changeset was rejected. This happens if:
    - the subject and predicate of a `create` triple/quad already exists in the dataset
    - any `delete` triples/quads don't exist in the dataset.
    You should not retry, but you may want to alter the changeset and resubmit.
- `ok` Gets called with the URI of the changeset if:
    - The update was successfully applied
    - The changeset was already applied
 
### Changeset Object Specification

- *add*: optional, must be an Array of quads to be added to the dataset
- *remove*: optional, must be an Array of quads to be removed from the dataset
- *previous*: optional, must be an Array of URIs of latest changesets of each _subject_ 
- *created*: optional, must be a full date time (including date, time, seconds, timezone)

#### Triple/Quad Specification

(format of the objects in the `add` `remove` `create` Arrays)

- *s*: required, URI (subject)
- *p*: required, URI (predicate/property)
- *o_value*: required (object value)
- *o_type*: required, must be `uri` OR `literal`
- *o_lang*: optional, must be valid language tag
- *o_datatype*: optional, URI
- *g*: optional, URI (graph)
 
