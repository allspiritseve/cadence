# Cadence

A Swiss Army asynchronous control flow function for JavaScript.

[Discussion](https://github.com/bigeasy/cadence/issues/1),
[Source](http://github.com/bigeasy/cadence),
[Issues](http://github.com/bigeasy/cadence/issues),
License: [MIT](https://github.com/bigeasy/cadence/blob/master/LICENSE)

The enemy of the good is the best.

Cadence builds you an asynchronous function with an error-first signature. It
uses a single `step` method to express all the control flows you've come to
expect from a control flow library.

Here's a function that will delete a file if it exists.

```javascript
var cadence = require('cadence')
var fs = require('fs')
var path = require('path')

var deleteIf = cadence(function (step, file) {
    step(function () {
        fs.readdir(path.dirname(file), step())
    }, function (files) {
        if (!files.some(function (f) { return f == file }).length) {
            return [ step, false ]
        }
        fs.unlink(file, step())
    }, function () {
        return [ true ]
    })
})

deleteIf('junk.txt', function (error, deleted) {
    if (error) console.log(error)
    console.log('junk.txt: was deleted ' + deleted)
})
```

A better way of doing this would be to try to delete the file, but catch an
`ENOENT` error if it doesn't exist.

```javascript
var cadence = require('cadence'), fs = require('fs')

var deleteIf = cadence(function (step, file) {
    step([function () {
        fs.unlink(file, step())
    }, /^ENOENT$/, function () {
        return [ step, false ]
    }], function () {
        return [ true ]
    })
})

deleteIf('junk.txt', function (error, deleted) {
    if (error) console.log(error)
    console.log('junk.txt: was deleted ' + deleted)
})
```

In the above we use a catch block to catch an `ENOENT` error and return false,
otherwise return true. If an error other than `ENOENT` is raised, the the error
will be passed as the first argument.

Note that for the simple examples, the simple solution is often as simple as
Cadence, but not simpiler.

```javascript
var fs = require('fs')

function deleteIf (file, callback) {
    fs.unlink(file, function (error) {
        if (error) {
            if (error.code == 'ENOENT') callback(null, false)
            else callback(error)
        } else {
            callback(null, true)
        }
    })
}

deleteIf('junk.txt', function (error, deleted) {
    if (error) console.log(error)
    console.log('junk.txt: was deleted ' + deleted)
})
```

Cadence can express all manner of asynchronous operations, including:

 * serial asynchronous operations, natch
 * parallel operations
 * while loops, do..while loops, or counted loops
 * each loops that can either map or reduce an array
 * single, streaming events and error event handlers
 * asynchronous try and catch exception handling
 * asynchronous finalizers for clean up

You can use Cadence in the browser too. It is not Node.js dependent and it
minzips to ~2.25k.

### Cadence Basics

We call the series of functions a ***cadence***. We call an individual function
in a cadence a ***step***. We use the `step` function to both define cadences
and to create the callbacks that will take us from one step to the next.

```javascript
// Use Cadence.
var cadence = require('cadence')
var fs = require('fs')

// Create an asynchronous function.
var cat = cadence(function (step) {
    step(function () {
        // Use `step()` to create a callback.
        fs.readFile(__filename, 'utf8', step())
    }, function (body) {
        // Any error is propagted to the caller, so our next step is only
        // invoked if everything is okay.
        process.stdout.write(body)
    })
})

// Use it in your program.
cat(function (error) { if (error) throw error })
```

The result of the callback invoked by `step()` is passed to the next step in the
cadence. The next step does not expect an error as its first argument. If there
is an error, the error is propagated up and out to caller's callback.

## Cadence Step by Step

In our examples we are going to use a function called echo which will invoke the
callback with the arguments given.

```javascript
function echo (value, callback) {
    callback(null, value)
}
```

Cadence exports a single function which by convention is named `cadence`.

```javascript
var cadence = require('cadence'), fs = require('fs')

var find = cadence(function ($, path, filter) {
    $(function () {
        fs.readdir(path, $())
    }, function (list) {
        return list.some(filter)
    })
})

function isJavaScript (file) {
    return /\.js$/.test(file)
}

find(__dirname, isJavaScript, function (error, found) {
    if (found) {
        console.log(__dirname + ' contains a JavaScript file.')
    }
})
```

Let's look closer at the `find` function.

```javascript
var find = cadence(function ($, path, filter) {
    $(function () {
        fs.readdir(path, $())
    }, function (list) {
        return list.some(filter)
    })
})
```

The find function is returned by calling `cadence`. The `cadence` function will
build a function that, when invoked, will call the function body.

The first argument is a universal builder function. We've named it `$` for
brevity, but you can name it whatever you'd like.

The universal builder function is invoked with a series of functions. The
creates a **cadence**. Each function is a **step** in the cadence.


The `cadence` function accepts a body function. It returns a function. The
function that it returns, when invoked, will invoke the function body.

The first parameter to the function body is always the magical `step` function.
The step function builds callbacks and cadences.

When you invoke `step` with no arguments, it builds a simple error first callback.

```javascript
var calledback = cadence(function (step) {
    echo(1, step())
})

calledback(function (error, value) {
    equal(value, 1, 'called back')
})
```

When you invoke `step` with a function, it creates a cadence. Each function in
the cadence is a step in the cadence.

```javascript
var stepping = cadence(function ($) {
    $(function () {
        echo(1, $())
    }, function (value) {
        return value + 1
    })
})

stepping(function (error, value) {
    equal(value, 2, 'incremented')
})
```

The results of one step are the arguments of the next step. The results of the
final step are the results of the cadence.

A step can return a value one of two ways. A step can either explicitly return a
value using a return statement or else it can pass values through a callback
created by invokeing the universal builder function.

## Serial and Parallel

A simple distinction between serial and parallel. The functions in a cadence are
run in **serial**. The callbacks build by calling `step()` withing a cadence are
invoked in **parallel**.

```javascript
var double = cadence(functions (step) {
    step(function () {
        echo(1, step())
        echo(2, step())
    }, function (one, two) {
        return { one: one, two: two }
    })
})(function (error, one, two) {
})
```

```javascript
var db = require('db'), fs = require('fs')

var initialize = cadence(function (step, conf) {
    step(function () {
        // These two operations happen in parallel.
        db.connect(step())
        fs.readFile(conf, 'utf8', step())
    }, function (conn, conf) {
        // The next step is called when both operations complete.
        conf = JSON.parse(conf)
        conn.encoding = conf.encoding || 'UTF-8'
        conn.lang = conf.lang || 'en_US'
        return conn // return an initialized connection.
    })
})

initialize(function (error, connection) {
    if (error) throw error
    run(connection)
})
```

A step inside a cadence can contain callbacks whose return values appear in the
next step or sub-cadences. The callbacks and sub-cadences in a step are run in
**parallel**, allowing you to mix and match cadences and sub-cadences to direct
the flow of your asynchronous program.

Note that Cadence is as terse as it can be. Yes, you must still use callbacks,
but it avoids the temple of doom by keeping your callbacks in line, one after
the other. It works hard so that indentation reflects a logical nesting of your
program into parallel operations, instead of having a nesting for each and every
callback.

### TODO

Note that it is simple to create sub-routines within your library using cadence.
Instead of passing a callback, pass the step function. A sub-cadence in the step
function will return to the next step in the caller's cadence.

### Cadences Within Steps Within Cadences

You can define a cadence within a step. This let's you work with results of an
asynchronous call.

Let's say that we want to get a `stat` object, but include the body of the file
in the `stat` object. When we get our `stat` object, we can use a sub-cadence to
complete the `stat` object by reading the body.

```javascript
var cadence = require('cadence'), fs = require('fs')

module.exports = cadence(function (step, file) {
    step(function () {
        fs.stat(file, step())
    }, function (stat) {
        step(function () {    // sub-cadence
            fs.readFile(file, 'utf8', step())
        }, function (body) {
            stat.body = body
            return stat;
        })
    })
})

```

In the above example, we create a sub-cadence so that we can read in the file
body and add it to the `stat` object. The sub-cadence allows us to update the
`stat` object asynchronously. It is in the scope of callback step invoked after
we read the file body with `fs.readFile`.

Here's how we would use this module.

```javascript
var bodyStat = require('./body-stat')

bodyStat(__filename, function (error, stat) {
    if (error) throw error
    console.log('Content-Length: ' + stat.size)
    console.log('')
    conosle.log(stat.body)
})
```

### Here's a Tour Guide Function; Echo

For the sake of our tour, let's implement an asynchronous function that we can
use to exercise Cadence. All it does is wait a bit, then invoke our callback.

```javascript
function echo (parameter, callback) {
    setImmediate(function () {
        callback(null, parameter)
    })
}
```

Let's use echo to illustrate the many difference flows possible with cadence.

### Subsequent Arguments

When you create callbacks in a Cadence step, the results are passed onto the
subsequent step. If you create multiple callbacks, the subsequent step will
receive the results in order.

```javascript
cadence(function () {
    step(function () {

        echo(1, step())
        echo(2, step())

    }, function (a, b) {

        equal(a, 1, 'first')
        equal(b, 2, 'second')

    })
})
```

The order of the callbacks determines the order of of the arguments.

```javascript
cadence(function () {
    step(function () {

        var first = step()
        var second = step()

        echo(2, second)
        echo(1, first)

    }, function (a, b) {

        equal(a, 1, 'first')
        equal(b, 2, 'second')

    })
})
```

In the above example, observe that the declaration order determines argument
order, not the order of invocation of the callbacks. Even if `second` is called
back before `first`, the argument to first in the subsequent step is invoked with
the results of `first` as the first argument `a`, and `second` as the second argument
`b`.

TK: More words and examples here.
TK: Example using `fs`.
TK: Always use an initial sub-cadence in the `README.md` so people don't get to
thinking that it is something to be avoided.
TK: In the sub-cadence example, talk about scope and closure.
TK: Move up a section.

Sometimes you don't have an asynchronous function to invoke. You can return a
a value to be used as the arguments for the subsequent step.

```javascript
cadence(function () {
    step(function () {
        return 1
    }, function (one) {
        equal(one, 1, 'returned')
    })
})
```

This happens quite often actually. Sometimes you've already invoked the
asynchronous function and have a copy of the result. Other times you want to do
some synchronous processing of the result of an asynchronous call. The example
below illustrates both cases.

```javascript
var fs = require('fs'), config

module.exports = cadence(function () {
    step(function () {
        if (config) return config
        else step(function () {
            fs.readFile('./config.json', 'utf8', step())
        }, function (body) {
            return config = JSON.parse(body)
        })
    })
})
```

Returning an array is a special case. When you return an array the elements of
the array are used as the arguments to the subsequent function.

```javascript
cadence(function () {
    step(function () {
        return [ 1, 2, 3 ]
    }, function (one, two, three) {
        equal(one, 1, 'returned one')
        equal(two, 2, 'returned two')
        equal(three, 3, 'returned three')
    })
})
```

What if you want to return an array as the sole argument to the subsequent
function? Then put the array in an array as the sole element.

```javascript
cadence(function () {
    step(function () {
        return [ [ 1, 2, 3 ] ]
    }, function (array) {
        equal(array[0], 1, 'element one')
        equal(array[1], 2, 'element two')
        equal(array[2], 3, 'element three')
    })
})
```

### Catching Errors

Cadence encourages parallelism, and because parallel operations can also
fail in parallel and/or raise many exceptions in parallel (fun stuff),
its internal error handling mechanism deals with arrays of errors.

Externally, however, your caller is expecting one single error, because Cadence
builds a function that follows the error-first callback standard. Thus, even
when there are many errors, the default is to return the first error that occurs
in the cadence.

When an error occurs, Cadence waits for all parallel operations to complete,
then it raises the error along with any other errors that occured in parallel.
If you want to catch these errors, create a try/catch function pair by wrapping
it in an array.

```javascript
cadence(function () {
    step([function () {

        // Do something stupid.
        fs.readFile('/etc/shadow', step())

    }, function (errors) {

        // Catch the exception.
        ok(errors[0].code == 'EACCES', 'caught EACCES')
        ok(errors.length == 1, 'caught EACCES and only EACCES')

    }])
})()
```

In the above, we catch the `EACCES` that is raised when we attempt to read a
read-protected file. Note the array that binds the catch function to the step
that proceeds it.

If no error occurs, the catch function is not invoked. The next function in the
cadence after the try/catch pair is invoked with the successful result of the
try function.

```javascript
cadence(function () {
    step([function () {

        // Read a readable file.
        fs.readFile('/etc/hosts', 'utf8', step())

    }, function (errors) {

        // This will not be called.
        proecss.stderr.write('Hosts file is missing!\n')

    }], function (hosts) {

        process.stdout.write(hosts)

    })
})()
```

When an error triggers the catch function, the catch function can recover and
continue the cadence by returning normally.

```javascript
cadence(function () {
    step([function () {

        // Read file that might be missing.
        fs.readFile(env.HOME + '/.config', 'utf8', step())

    }, function (errors) {

        // That didn't work, for whatever reason, so try the global.
        fs.readFile('/etc/config', 'utf8', step())

    }], function (config) {

        process.stdout.write(config)

    })
})()
```

Also note that both the try function and error function can use sub-cadences,
arrayed cadences, fixups, etc.; everything that Cadence has to offer.

A catch function also catches thrown exceptions.

```javascript
cadence(function () {
    step([function () {

        throw new Error('thrown')

    }, function (errors) {

        ok(errors[0].message == 'thrown', 'caught thrown')
        ok(errors.length == 1, 'caught thrown and only thrown')

    }])
})()
```

Errors are provided in an `errors` array. Why an array, again? Because with Cadence,
you're encouraged to do stupid things in parallel.

```javascript
cadence(function () {
    step([function () {

        // Read two read-protected files.
        fs.readFile('/etc/shadow', step())
        fs.readFile('/etc/sudoers', step())

    }, function (errors) {

        ok(errors[0].code == 'EACCES', 'caught EACCES')
        ok(errors[1].code == 'EACCES', 'caught another EACCES')
        ok(errors.length == 2, 'caught two EACCES')

    }])
})()
```

Note that the errors are indexed in the **order in which they were caught**,
not in the order in which their callbacks were declared.

The second argument to a function callback is the first error in the errors
array. This is in case you're certain that you'll only ever get a single error,
and the array subscript into the `errors` array displeases you.

```javascript
cadence(function () {
    step([function () {

        fs.readFile('/etc/shadow', step())

    }, function (errors, error) {

        ok(error.code == 'EACCES', 'caught EACCES')

    }])
})()
```

For the sake of style, when you don't want to reference the errors array, you
can of course hide it using `` _ `` or, if that is already in use, double `` __ ``.

```javascript
cadence(function () {
    step([function () {

        fs.readFile('/etc/shadow', step())

    }, function (_, error) {

        ok(error.code == 'EACCES', 'caught EACCES')

    }])
})()
```

### Propagating Errors

You can propagate all of the caught errors by throwing the `errors` array.

Imagine a system where sudo is not installed (as is the case with a base
FreeBSD.)

```javascript
cadence(function () {
    step([function () {

        // Read two read-protected files.
        fs.readFile('/etc/sudoers', step())
        fs.readFile('/etc/shadow', step())

    }, function (errors) {

        // Maybe sudo isn't installed and we got `ENOENT`?
        if (!errors.every(function (error) { return error.code == 'EACCES' })) {
            throw errors
        }

    }])
})(function (error) {

    // Only the first exception raised is reported to the caller.
    if (error) console.log(error)

})
```

You can also just throw an exception of your chosing.

```javascript
cadence(function () {
    step([function () {

        // Read two read-protected files.
        fs.readFile('/etc/sudoers', step())
        fs.readFile('/etc/shadow', step())

    }, function (errors) {

        // Maybe sudo isn't installed and we got `ENOENT`?
        if (!errors.every(function (error) { return error.code == 'EACCES' })) {
            throw new Error('something bad happened')
        }

    }])
})(function (error) {

    ok(error.message, 'something bad happened')

})
```

When you raise an error in a catch function, it cannot be caught in the current
cadence. You can still catch it in a calling cadence, however.

Here we log any errors before raising them all up to the default handler:

```javascript
cadence(function () {
    step([function () {
        step([function () {

            // Read two read-protected files.
            fs.readFile('/etc/sudoers', step())
            fs.readFile('/etc/shadow', step())

        }, function (errors) {

            // Maybe sudo isn't installed and we got `ENOENT`?
            if (!errors.every(function (error) { return error.code == 'EACCES' })) {
                throw errors
            }

        }])
  }, function (errors) {

      errors.forEach(function () { console.log(error) })
      throw errors

  }])
})(function (error) {

    ok(error, 'got a single error')

})
```

As you can see, Cadence will catch exceptions as well as handle errors passed to
callbacks.

### Conditional Error Handling

Dealing with an array of errors means you're almost always going to want to
filter the array to see if it contains the error you're expecting, and which error
that might be. Because this is so common, it's built into Cadence.

To create a try/catch pair that will respond only to certain errors, add a
regular expression between the try function and the catch function.

```javascript
cadence(function () {
    step([function () {

        // Read file that might be missing.
        fs.readFile(env.HOME + '/.config', 'utf8', step())

    }, /^ENOENT$/, function () {

        // That didn't work because the file does not exist, try the global.
        fs.readFile('/etc/config', 'utf8', step())

    }], function (config) {

        process.stdout.write(config)

    })
})()
```

In the above example, we only catch an exception if the `code` property matches
/ENOENT/. If there is a different error- say, the file exists but we can't
read it- that error is not caught by our try/catch pair.

The condition is tested against the `code` property if it exists. If it doesn't
exist then it is tested against the `message` property.

You can easily test for multiple error codes using a regular expression, as
well. Here we test for both `EACCES` and `ENOENT`.

```javascript
cadence(function () {
    step([function () {

        fs.readFile('/etc/sudoers', step())
        fs.readFile('/etc/shadow', step())

    }, /^(EACCES|ENOENT)$/, function (errors) {

        ok(errors.length == 2, 'handled')

    }])
})()
```

You can also be explicit about the property used to test by adding the name of
that property between the try function and the condition. Here we explicitly
state that the `code` property is the property to test.

```javascript
cadence(function () {
    step([function () {

        fs.readFile('/etc/sudoers', step())
        fs.readFile('/etc/shadow', step())

    }, 'code', /^(EACCES|ENOENT)$/, function (errors) {

        ok(errors.length == 2, 'handled')

    }])
})()
```

If the condition does not match all the examples raised, then the catch function
is not invoked, and the errors are propagated.

However, if the errors are not caught and propagated out of Cadence and to the
caller, then the caller will receive the first exception that did not match the
conditional.

```javascript
cadence(function () {
    step([function () {

        step()(null,
        fs.readFile('/etc/sudoers', step())
        fs.readFile('/etc/shadow', step())

    }, /^(EACCES|ENOENT)$/, function (errors) {

        ok(errors.length == 2, 'handled')

    }])
})()
```

Why? Because we can only return one exception to the caller, so it is better to
return the unexpected exception that caused the condition to fail, even if it
was not the first exception raised by the Cadence. It makes it clear that the
condition is failing because of additional errors.

TK: Throwing errors resets the concept of unmatched.

#### Error Catching Example

Let's extend our `deleteIf` function. Let's say that if the file doesn't exist,
we ignore the error raised when we stat the file. To catch the error we wrap our
call to `stat` in a try/catch function pair. If the call to `stat` results in
`ENOENT`, our catch function is called. The catch function simply returns early
because ther is no file to delete.

```javascript
// Use Cadence.
var cadence = require('cadence'), fs = require('fs')

// Delete a file if it exists and the condition is true.
var deleteIf = cadence(function (step, file, condition) {
    step([function () {

        fs.stat(file, step())

    }, /^ENOENT$/, function (error) {

        // TK: Early return example can be if it is a directory, return early.
        step(null)

    }], function (stat) {

      if (stat && condition(stat)) fs.unlink(step())

    })
})

// Test to see if a file is empty.
function empty (stat) { return stat.size == 0 }

// Delete a file if it exists and is empty.
deleteIf(__filename, empty, function (error) { if (error) throw error })
```

We test to see if the error is `ENOENT`. If not, we have a real problem, so we
throw the error. The throw is caught and forwarded to the callback that invoked
the cadence function.

If the error is `ENOENT`, we exit early by calling the step function directly as
a if it were itself an error/result callback, passing `null` to indicate no
error.

## Working with Events

Cadence also works with event emitting objects that do not accept an error as
the first parameter. These are event mechanisms like the DOM events or the
events generated by the Node.js `EventEmitter`.

To indicate that you want an event handler, use `-1` as the first parameter to
the `step` function.

Why is `-1` the mnemonic for an event? Think of the the `-1` as a shift of
sorts, we're moving things to the left by one. Negative numbers are to the left.
Isn't syntax bashing fun?

Here is a unit test for working with `EventEmitter` illustrating the use of
events in Cadence.

```javascript
var cadence = require('cadence'), event = require('event')
  , ee = new event.EventEmitter()

cadence(function (step, ee) {
    step(function () {
        ee.on('data', step(-1, []))
        ee.on('end', step(-1))
        ee.on('error', step(Error))
    }, function (data) {
        assert.deepEqual(data, [ 1, 2, 3 ])
    })
})(emitter)

ee.emit('data', 1)
ee.emit('data', 2)
ee.emit('data', 3)

ee.emit('end')
```

Below we use the example of splitting an HTTP server log for many hosts
into a log file for each host.

```javascript
var cadence = require('cadence'), fs = require('fs')

cadence(function (step) {
    step(function () {
        var readable = fs.readableStream(__dirname + '/logins.txt')
        readable.setEncoding('utf8')
        readable.on('data', step.event([]))
        readable.on('end')
    }, function (data) {
        var hosts = {}
        data.join('').split(/\n/).foreach(function (line) {
            var host = /^([\w\d.]+)\s+(.*)/.exec(line)[1]
            (hosts[host] || (hosts[host])).push(line)
        })
        for (var host in hosts) {
            var writable = fs.writableStream(__dirname + '/' + host + '.log')
            writable.end(hosts[host].join('\n') + '\n')
            writable.on('drain', step.event())
        }
    })
})()
```

This is a horrible example. Try again.

Here's a `mkdirp`, but let's complete it.

```javascript
var mkdirs = cadence(function (step, directory) {
    directory = path.resolve(directory)
    var mode = 0777 & (~process.umask())
    var made = null

    step([function () {
        fs.mkdir(directory, mode, step())
    }, function (_, error) {
        if (error.code == 'ENOENT') {
            mkdirp(path.dirname(directory), step())
        } else {
            step(function () {
                fs.stat(directory, step())
            }, function (stat) {
                if (!stat.isDirectory()) step(error)
            })
        }
    }])
})
```

## Loops

TK: Serial and parallel loops, but parallel doesn't really loop.

### Serial Loops

TK: So, just Loops, then? What about Serial Each and Parallel Each?
TK: Do examples look better without commas?

Cadence wants you to use nesting to represent subordinate operations, so it wants
to provide you with a looping structure that is not terribily compilicated, or
nested.

Looping in Cadence is performed by defining a sub-cadence, then invoking the
function that is returned by the sub-cadence definition. We'll call this the
**looper function**. If you **do not invoke** the function, Cadence will start
the sub-cadence for you when your step returns and run the sub-cadence once. If
you **do invoke** the function, Cadence will run the sub-cadence as a loop.

You can create `while` loops, `do...while` loops, stepped loops and `forEach`
loops using the looper function.

### Endless Loops

If you invoke without arguments, you will invoke an endless loop. You terminate
the loop using the `step(error, result)` explicit return.

Calling `looper()`.

```javascript
cadence(function (step) {
    var count = 0
    step(function () {
        count++
    }, function () {
        if (count == 10) step(null, count)
    })() //immediate invocation
})(function (error, result) {
    if (error) throw error
    equal(result, 10, 'loop')
})()
```

When your terminal condition is the last function, you've basically created a
`do...while` loop.

### Loop Initializers

When an endless loop iterates, the result of the last function is passed as
arguments to the first function. You can use this to create a `while` loop.

To pass in an initial test value to the endless loop, you invoke the looper
function with a leading `null`, followed by the parameters, `looper(null, arg1,
arg2)` the same the way you invoke an explicit return of the `step` function.

Calling `looper(null, arg)`.

```javascript
cadence(function (step) {
    var count = 0
    step(function (more) {
          if (!more) step(null, count)
    }, function () {
          step()(null, ++count &lt; 10)
    })(null, true)
})(function (error, result) {
    if (error) throw error
    equal(result, 10, 'initialized loop')
})
```

### Counted Loops

You can tell Cadence to loop for a fixed number of times by invoking the loop
start function with a count of iterations.

```javascript
cadence(function (step) {
    var count = 0
    step(function (count) {
        equal(count, index, 'keeping a count for you')
        step()(null, ++count)
    })(10)
})(function (error, result) {
    if (error) throw error
    equal(result, 10, 'counted loop')
})
```

### Each Loops

You can invoke the loop passing it an array. The loop will be invoked once for
each element in the array, passing the array element to the first function of
the sub-cadence.

```javascript
cadence(function (step) {
    var sum = 0
    step(function (number, index) {
        equal(index, number - 1, 'keeping an index for you')
        step()(null, sum = sum + number)
    })([ 1, 2, 3, 4 ])
})(function (error, result) {
    if (error) throw error
    equal(result, 10, 'reduced each loop')
})
```

### Gathered Loops

Both counted loops and each loops can be gathered into an array. If you pass an
initial array to the callback function, then each iteration will be gathered
into an array result.

```javascript
cadence(function (step) {
    var count = 0
    step(function () {
        step()(null, ++count)
    })([], [ 1, 2, 3, 4 ])
})(function (error, result) {
    if (error) throw error
    deepEqual(result, [ 1, 3, 6, 10 ], 'gathered each loop')
})
```

You cannot gather endless loops.

### Loop Labels

If you want to give up early and try again, you can use a loop label. When you
invoke the looper function it returns a label object. You can use the label
object to restart the loop.

```javascript
cadence(function (step) {
    var count = 0
    var retry = step([function () {
        if (++count != 10) throw new Error
        else step(null, 10)
    }, function () {
        step(retry)
    }])(1)
})(function (error, result) {
    if (error) throw error
    equal(result, 10, 'loop continue')
})
```

This one's tricky. Because we specified a count of `1`, the loop will only loop
once, but because we call the `retry` label when we catch an error, the loop
tries again.

### Loop Label Quick Returns

Some of the things we document here are about style and syntax bashing that you
can do. It's not necessarily a part of Cadence.

Often times when working with labels, you're testing to see if you should invoke
the label when you enter a function; if not you would like to do something else.
This is going to create an `if/else` block that increases our nesting. If we
were programming synchronously in plain old JavaScript, we could call `continue`
and that would jump to the loop label.

To preserve that jumpy feeling, when you invoke `step(label)` it returns true,
so you can create a return using `&&`.

```javascript
cadence(function (step) {
    var retry = step([function (count) {
        if (count != 10) throw new Error('retry')
        else step(null, 10)
    }, function (_, error) {
        if (error.message == 'retry') return step(retry) && count + 1
        throw error
    }])(1, 0)
})(function (error, result) {
    if (error) throw error
    equal(result, 10, 'loop continue')
})
```

TK: Another example of this...

```javascript
if (count != stop) return step(retry) && return count + 1
```

## Control Flow

Here is where you would discuss `step.jump` and the function index.
