const sha1 = require('sha1')
const Either = require('data.either')

module.exports = function applyChangesetConfig(sparqlQuery, sparqlUpdate){
    return function applyChangeset(changeset){
        const id = sha1(changeset)
        const changesetURI = 'urn:hash:sha1:'+id
        const update = `
PREFIX dc: <http://purl.org/dc/terms/>
DELETE {
    ${changeset.remove.map(quadToSparql).join('\n')}        
} INSERT {
    ${changeset.add.map(quadToSparql).join('\n')}
    ${changeset.create.map(quadToSparql).join('\n')}
    <${changesetURI}> dc:dateAccepted NOW() .
} WHERE {
    ${changeset.remove.map(quadToSparql).join('\n')}
    ${changeset.create.map(propertyNotExists).join('\n')}
    FILTER NOT EXISTS { <${changesetURI}> dc:dateAccepted ?date .}
}
        `
        const confirmationQuery = `ASK WHERE {<${changesetURI}> ?p ?o }`
        return sparqlUpdate(update)
        .chain(_=>sparqlQuery(confirmationQuery))
        .map(result=> result.boolean? Either.Right(changesetURI) : Either.Left("Changeset Rejected"))
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
            : o_datatype? `^^${o_datatype}` 
                : ''
    const obj = o_type=='variable'? `[]` 
            : o_type=='uri'? `<${o_value}>` 
                    : `"""${o_value}"""${obj_end}` 

    const triple = `<${s}> <${p}> ${obj} . `
    return g? `GRAPH <${g}> { ${triple} }` : triple
}
