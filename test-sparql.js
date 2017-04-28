const request = require('request')

const setupInsert = `
PREFIX dc: <http://purl.org/dc/terms/>
PREFIX : <http://data.smoke-mirrors.co.uk/def/>
PREFIX cs: <http://purl.org/vocab/changeset/schema#>
BASE <http://example.info/>
PREFIX c: <changes/>
PREFIX s: <resources/>

DROP ALL;

INSERT DATA {
c:_1 cs:subjectOfChange s:A, s:B .	
c:_2 cs:subjectOfChange s:C .	
c:_3 cs:subjectOfChange s:A ; cs:previousChangeSet c:_1 .
}
`
const tests = `
 [ cs:subjectOfChange s:A, s:B ; cs:previousChangeSet c:_1, c:_3 ] #good
 [ cs:subjectOfChange s:A, s:B ; cs:previousChangeSet c:_1, c:_2 ] #bad
 [ cs:subjectOfChange s:A, s:C ; cs:previousChangeSet c:_1, c:_2 ] #bad
 [ cs:subjectOfChange s:A, s:C ; cs:previousChangeSet c:_1, c:_3 ] #bad
 [ cs:subjectOfChange s:A, s:C ; cs:previousChangeSet c:_2, c:_3 ] #good
 [ cs:subjectOfChange s:B, s:C ; cs:previousChangeSet c:_2, c:_3 ] #bad
 [ cs:subjectOfChange s:B, s:C ; cs:previousChangeSet c:_1, c:_2 ] #good
 [ cs:subjectOfChange s:A ; cs:previousChangeSet c:_3 ] #good
 [ cs:subjectOfChange s:A ; cs:previousChangeSet c:_1 ] #bad
 [ cs:subjectOfChange s:Z  ] #good
`
console.log(setupInsert)
runUpdate(setupInsert)
(runTests)

function runTests(){
    tests
    .trim()
    .split('\n')
    .map(line => ({ line
        , subjects: line.match(/s:[A-Z]/g)
        , expected: line.match(/(bad)|(good)/)[0]
        , prev: line.match(/c:_[0-9]/g) || []})
    ).map(data => ({data,  query: csToSparql(data)}))
    .forEach(x => runQuery(x.query)(actual => {
        const expected = (x.data.expected==='good')
        const msg = (actual===expected)? 'Passed.' : 'Failed: expected '+JSON.stringify(expected)+ ' got: '+actual  
        console.log(msg, x.data.line)
    }))
}

function csToSparql(cs){
    return `
PREFIX cs: <http://purl.org/vocab/changeset/schema#>
BASE <http://example.info/>
PREFIX c: <changes/>
PREFIX s: <resources/>
ASK WHERE { 
    ${cs.subjects.map((s, i) => `
    { 
       FILTER NOT EXISTS { ?latest_${i} cs:subjectOfChange ${s} . }
    }
    UNION {
        ?latest_${i} cs:subjectOfChange ${s} .
        FILTER NOT EXISTS { 
            ?newer_${i} cs:previousChangeSet ?latest_${i} 
            ; cs:subjectOfChange ${s} 
        }
        FILTER(?latest_${i} IN (${cs.prev.join(', ')}))
    }
`).join('\n')}
}`
}

function runQuery(query){
    return callback => request({
        url: 'http://localhost:3030/test/sparql',
        qs: {query: query},
        headers: {Accept: "application/sparql-results+json"}
    }, function(err, data){
        if(!err && data.statusCode!=200) err = new Error(data.body)
//        console.log("runQuery", query, err, data.body)
        ;(err || data.statusCode!=200)? console.error(err) : callback(JSON.parse(data.body).boolean)
    })
}

function runUpdate(update){
    return callback => request({
        url: 'http://localhost:3030/test/update',
        body: update,
        method: 'POST',
        headers: {'Content-type': "application/sparql-update"}
    }, function(err, data, body){
        if(!err && data.statusCode!=204) err = new Error(data.body)
        ;(err)? console.error(err, data.body) : callback(data.body)
    })

}

