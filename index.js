const sha1 = require('sha1')
const Task = {
    chain: f => fork => 
        (rej, res) => fork(rej, x => f(x)(rej, res)),
    map: f => fork => 
        (rej, res) => fork(rej, x=> res(f(x))),
    fromNodeStyle: f => x => (rej, res) => f(x, (err, data)=> err? rej(err) : res(data))
}
const pipeWith = chain => (...funcs) => funcs.reduce((f, g) => x => chain(g)(f(x)))
const pipe = pipeWith(Task.chain)

module.exports = function applyChangesetWith(sparqlQueryNode, sparqlUpdateNode){
    
    const sparqlQuery = Task.fromNodeStyle(sparqlQueryNode)
    const sparqlUpdate = Task.fromNodeStyle(sparqlUpdateNode)

    return function applyChangeset(changeset, callbacks){
        const id = sha1(JSON.stringify(changeset))
        const changesetURI = 'urn:hash:sha1:'+id
        const arrayKeys = ['remove', 'add']
        arrayKeys.forEach(k => changeset[k]=changeset[k]||[])
        const changegraph = 'app://graphs/changesets'
        const previous = changeset.previous || []
        const prev = previous.length? 
            `; cs:previousChangeSet ${changeset.previous.map(s => `<${s}>`).join(', ')}` : ``

        const subjects = unique([...changeset.remove.map(getSubject), ...changeset.add.map(getSubject)])
        const update = `
PREFIX dc: <http://purl.org/dc/terms/>
PREFIX cs: <http://purl.org/vocab/changeset/schema#>
PREFIX csex: <app://vocab/changeset-extension/schema#>
DELETE {
    ${changeset.remove.map(quadToSparql).join('\n')}        
    GRAPH <${changegraph}> { 
        ${subjects.map(s => `<${s}> csex:latestChangeSet ?latestChangeSet .`).join('\n')} 
    }
} INSERT {
    ${changeset.add.map(quadToSparql).join('\n')}
    GRAPH <${changegraph}> { 
        <${changesetURI}> dc:dateAccepted ?now
            ; cs:subjectOfChange ${subjects.map(s => `<${s}>`).join(', ')} 
            ${prev}
        . 
        ${subjects.map(s => `<${s}> csex:latestChangeSet <${changesetURI}> .`).join('\n')}
    }
} WHERE {
    BIND(NOW() AS ?now)
    
    ${subjects.map(s => `GRAPH <${changegraph}> {
        OPTIONAL { <${s}> csex:latestChangeSet ?latestChangeSet . }
    }`).join('\n')}
    
    ${changeset.remove.map(quadToSparql).join('\n')}
    
    FILTER NOT EXISTS { 
        GRAPH <${changegraph}> { <${changesetURI}> dc:dateAccepted ?date . }
    }
    ${checkCandidateIsLatest(changegraph, previous, subjects)}
}
        `
        const confirmationQuery = `ASK WHERE { GRAPH <${changegraph}> { <${changesetURI}> ?p ?o } }`
        
        const op = pipe(
            sparqlUpdate,
            _=>sparqlQuery(confirmationQuery),
            checkQueryResponse
        )(update)
        
        return op(callbacks.error, 
            result => result.boolean===true? 
                callbacks.ok(changesetURI) : callbacks.rejected("Changeset Rejected "+ update)
        )
    }
}

//this query snippet could be a little simpler if we changed the changeset format to something like
//[
//  {
//      subject: URI,
//      previousChangeSet: URI,
//      add: [ {p, o, g} ],
//      remove: [ {p, o, g} ]
//  }
//  
//]
//though some of the other insertion logic might be trickier
//- we still need the whole batch to fail if one fails

function checkCandidateIsLatest(changegraph, previous, subjects){
    return previous.length? `GRAPH <${changegraph}> {` + subjects.map((s, i) => `
    { 
       FILTER NOT EXISTS { ?latest_${i} cs:subjectOfChange <${s}> . }
    }
    UNION {
        ?latest_${i} cs:subjectOfChange <${s}> .
        FILTER NOT EXISTS { 
            ?newer_${i} cs:previousChangeSet ?latest_${i} 
            ; cs:subjectOfChange <${s}> 
        }
        FILTER(?latest_${i} IN (${previous.map(p=>`<${p}>`).join(', ')}))
    }
    `).join('\n')+` }` : ''
}

function unique(arr){
    const len = arr.length
    const output = []
    for(var i =0; i < len; i++){
        if(output.indexOf(arr[i]) === -1) output.push(arr[i])
    }
    return output
}

function getSubject(quad){
    return quad.s
}

function checkQueryResponse(response){
    return (reject, resolve) => {
        (typeof response==='object') && response.hasOwnProperty('boolean')?
            resolve(response) : reject("sparqlQuery function does not return valid SPARQL JSON format: "+response)
    }
}

function propertyNotExists(quad){
    const {s, p, g} = quad
    const variableQuad = {s, p, g, o_type: 'variable'}
    return `FILTER NOT EXISTS { ${quadToSparql(variableQuad)} }`
}

function quadToSparql(quad){
    const {g, s, p, o_value, o_type, o_datatype, o_lang} = quad
    const obj_end = o_lang? `@${o_lang}` 
            : o_datatype? `^^<${o_datatype}>` 
                : ''
    const obj = o_type=='variable'? `[]` 
            : o_type=='uri'? `<${o_value}>` 
                    : `"""${o_value}"""${obj_end}` 

    const triple = `<${s}> <${p}> ${obj} . `
    return g? `GRAPH <${g}> { ${triple} }` : triple
}
