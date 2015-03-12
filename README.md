# level-async-transaction

Async transactional layer for [levelup](https://github.com/rvagg/node-levelup) and [level-sublevel](https://github.com/dominictarr/level-sublevel). 
Uses Two-Phase Commit approach with read/write lock, commits and rollbacks for levelup database with level-sublevel prefix support.

[![Build Status](https://travis-ci.org/cshum/level-async-transaction.svg?branch=master)](https://travis-ci.org/cshum/level-async-transaction)

```bash
npm install level-async-transaction
```

```Javascript
var levelup = require('levelup');
var db = levelup('./db',{ valueEncoding: 'json' });

var transaction = require('level-async-transaction');
transaction(db);

var tx = db.transaction();
tx.get('k', function(err, value){
  setTimeout(function(){
    tx.put('k', 167, function(err){
      tx.commit();
    });
  },100);
});
var tx2 = db.transaction();
tx2.get('k', function(err, value){
  tx2.put('k', value + 1, function(err, value){
    tx2.commit(function(){
      //k now equals to 168 in store
    });
  });
});
```

###db.transaction()

Create a transaction object.

###tx.get(key[, options][, callback])

`get()` fetches data from store, or transaction object if lock acquired. 

It acquires a read lock for `key`, and callback with value or `NotFoundError` only when lock acquired successfully. 
Otherwise if read lock failed due to potential deadlock, callback with error Deadlock.

###tx.put(key, value[, options][, callback])

`put()` inserts data into transaction object, 
and will only be inserted into store upon successful commit. 

It acquires a write lock for the `key`, and callback only when lock acquired.
Otherwise if write lock failed due to potential deadlock, callback with error Deadlock.

###tx.del(key[, options][, callback])

`del()` removes data from transaction object, 
and will only be removed from store upon successful commit. 

It acquires a write lock for the `key`, and callback only when lock acquired.
Otherwise if write lock failed due to potential deadlock, callback with error Deadlock.

###tx.commit([callback])

`commit()` batches data from transaction object into the store.
Uses levelup's `batch()` under the hood, 
all operations will be written to the database atomically, that is, they will either all succeed or fail with no partial commits.

Upon successful or failed commit, locks acquired during transaction will be released.

###tx.rollback([callback])

`rollback()` releases locks acquired during transaction.

## License

MIT