#!/usr/bin/env node

require('proof')(6, function (step, assert) {
    var cadence = require('../..')

    cadence(function (step) {

        step(function () {
            (function (callback) {
                callback(null, 1)
            })(step(step)(function (number) {
                return number + 1
            }))
        }, function (value) {
            assert(value, 2, 'fixup direct')
        })

    })(step())

    cadence(function (step) {

        step(function () {
            (function (callback) {
                callback(new Error('errored'), 1)
            })(step(step)(function () {
                throw new Error('should not be called')
            }))
        }, function () {
            throw new Error('should not be called')
        })

    })(function (error) {
        assert(error.message, 'errored', 'fixup short circuit')
    })

    cadence(function (step) {

        echo(1, step(step)(function (number) {
            echo(- number, step())
        }))

    }, function (items) {

        assert(items, -1, 'fixup cadence')

    })(step())

    // This triggers a test of error handling when the fixup cadence errors,
    // whether the next object in the sub cadence recieves the error.
    cadence(function (step) {

        step(function () {

            echo(1, step(step)(function (number) {
                 throw new Error('errored')
            }))

        }, function () {

            throw new Error('should not be called')

        })

    })(function (error) {

        assert(error.message, 'errored', 'inner error')

    })

    cadence(function (step) {

        echo(1, step(step)(function (number) {
            throw new Error('thrown')
            echo(- number, step())
        }))

    })(function (error) {
        assert(error.message, 'thrown', 'errors')
    })

    cadence(function (step) {

        var numbers = step(step)([], function (number) { return - number })

        ; [ 1, 2, 3 ].forEach(function (number) {
            echo(number, numbers())
        })

    }, function (numbers) {

        assert(numbers, [ -1, -2, -3 ], 'fixup array cadence')

    })(step())
})

function echo (value, callback) { process.nextTick(function () { callback(null, value) }) }
