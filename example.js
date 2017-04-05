const Task = require('data.task')
const Either = require('data.either')
const applyChangsetConfig = require('./index.js')

const update = update => {
    console.log(update)
    return Task.of("anything")
}
const failConfirmation = query => Task.of({boolean: false})
const succeedConfirmation = query => Task.of({boolean: true})
const EX = 'http://example.info/'
const changeset = {
    created: new Date().toISOString(),
    create: [{s: EX+'123', p: EX+'count', o_value: 0, o_type:'literal', o_datatype: EX+'integer'}],
    add: [{s: EX+'987', p: EX+'message',  o_value: "bonjour", o_type:'literal', o_lang: 'fr-fr'}],
    remove: [{s: EX+'987', p: EX+'link',  o_value: EX+"678", o_type:'uri'}],
}

const applyChangesetSuccess = applyChangsetConfig(succeedConfirmation, update)
const applyChangesetFail = applyChangsetConfig(failConfirmation, update)

applyChangesetSuccess(changeset).fork(
    console.error
    , result => {
        console.log("changeset should succeed:", result.fold(i=>i, i=>i))
    }
)
applyChangesetFail(changeset).fork(
    console.error
    , result => {
        console.log("changeset should fail:", result.fold(i=>i, i=>i))
    }
)




