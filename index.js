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

module.exports = function applyChangesetConfig(sparqlQueryNode, sparqlUpdateNode){
    
    const sparqlQuery = Task.fromNodeStyle(sparqlQueryNode)
    const sparqlUpdate = Task.fromNodeStyle(sparqlUpdateNode)

    return function applyChangeset(changeset, callbacks){
        const id = sha1(JSON.stringify(changeset))
        const changesetURI = 'urn:hash:sha1:'+id
        const arrayKeys = ['remove', 'add', 'create']
        arrayKeys.forEach(k => changeset[k]=changeset[k]||[])
        const changegraph = 'app://graphs/changesets'
        const previous = changeset.previous || []
        const prev = previous.length? 
            `; cs:previousChangeSet ${changeset.previous.map(s => `<${s}>`).join(', ')}` : ``
        const update = `
PREFIX dc: <http://purl.org/dc/terms/>
PREFIX cs: <http://purl.org/vocab/changeset/schema#>
DELETE {
    ${changeset.remove.map(quadToSparql).join('\n')}        
} INSERT {
    ${changeset.add.map(quadToSparql).join('\n')}
    GRAPH <${changegraph}> { 
        <${changesetURI}> dc:dateAccepted ?now
            ; cs:subjectOfChange ${subjects.map(s => `<${s}>`).join(', ')} 
            ${prev}
        . 
    }
} WHERE {
    BIND(NOW() AS ?now)
    ${changeset.remove.map(quadToSparql).join('\n')}
    FILTER NOT EXISTS { 
        GRAPH <${changegraph}> { <${changesetURI}> dc:dateAccepted ?date . }
    }
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
