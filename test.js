const test = require('tape');
const NS = 'urn:id:string:'
const request = require('request')
const endpoint = 'http://localhost:3030/test'
const sparqlEndpoint = endpoint+'/sparql'
const updateEndpoint = endpoint+'/update'

const httpQuery = (q, callback) => request({
    url: sparqlEndpoint,
    body: q,
    method: 'POST',
    headers: {
        'Accept': 'application/sparql-results+json',
        'Content-type': 'application/sparql-query'
    }
}, (err, data)=> err? callback(err) : callback(null, JSON.parse(data.body)))

const httpUpdate = (q, callback) => request({
    url: updateEndpoint,
    body: q,
    method: 'POST',
    headers: {
        'Accept': 'application/sparql-results+json',
        'Content-type': 'application/sparql-update'
    }
}, callback)
const applyChangeset = require('./index.js')(httpQuery, httpUpdate)

test('Reject changesets removing triples that do not exist', function (t) {
    t.plan(1)
    const changeset = removeResources([], [{id: "a", name: "A", foo: "bar"}, {id: "b", name: "B"}])
    applyChangeset(changeset, {
        error: x => t.fail(x),
        ok: x => t.fail("changeset not rejected "+x),
        rejected: x => t.pass("changeset rejected")
    })
})
test('creating new resources', function (t) {
    t.plan(3)
    const initial = [{id: "a", name: "A", foo: "bar"}, {id: "b", name: "B"}]
    const afterEdit = [{id: "a", name: "X", foo: "baz"}, {id: "b", name: "Y"}] 
    const changeset = createResources(initial)
    httpUpdate('DROP ALL;', function resourceCreation(err, data){
        if(err) return console.error(err)
        changesetSuccess(changeset, uri=>{
            t.pass("resources created")
            const editChangeset = editResources([uri], initial, afterEdit)
            changesetSuccess(editChangeset, editUri => {
                t.pass("resources edited")
                const deleteChangeset = removeResources([editUri], afterEdit)
                changesetSuccess(deleteChangeset, delUri=> {
                    t.pass("resource deleted")
                })
            })
        })
    })
})

function changesetSuccess(changeset, okCallback){
    applyChangeset(changeset, {
            error: x => t.fail(x),
            ok: okCallback,
            rejected: x => t.fail("changeset rejected")
    })
}

function changesetFail(changeset,rejectedkCallback){
    applyChangeset(changeset, {
            error: x => t.fail(x),
            ok: t.fail("changeset should have been rejected"),
            rejected: rejectedCallback
    })
}


function createResources(resources){
    return {
        created: new Date().toISOString(),
        add: resourcesToTriples(resources)    
    }
}

function editResources(previous, befores, afters){
    return {
        previous,
        remove: resourcesToTriples(befores),
        add: resourcesToTriples(afters)
    }
}

function removeResources(previous, resources){
    return {
        previous,
        remove: resourcesToTriples(resources)
    }
}

function resourcesToTriples(resources){
    return resources.map(pojo => Object.keys(pojo)
                .filter(k=>k!='id')
                .map(k => ({s: NS+pojo.id, p: NS+k, o_value: pojo[k], o_type: 'literal' }))
             ).reduce((result, item) => [...result, ...item], [])
}



