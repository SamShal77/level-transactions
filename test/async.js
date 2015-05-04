var tape         = require('tape'),
    levelup      = require('levelup'),
    down         = require('memdown'),
    transactions = require('../');

tape('Async',function(t){
  t.plan(2);

  var db = levelup('test', {
    db: down,
    valueEncoding: 'json'
  });
  transactions(db);

  var tx = db.transaction();
  var tx2 = db.transaction();

  tx.put('k', 167);

  tx2.get('k', function(err, value){
    t.equal(value, 167, 'tx2 get equals 167');
    tx2.put('k', value+1);
  });

  tx.commit();

  tx2.commit(function(err){
    db.get('k', function(err, value){
      t.equal(value, 168, 'db get equals 168');
    });
  });
});

tape('Async commit',function(t){
  t.plan(2);

  var db = levelup('test', {
    db: down,
    valueEncoding: 'json'
  });
  transactions(db);

  var tx = db.transaction();
  var tx2 = db.transaction();

  tx.put('k', 167);
  tx.commit();

  tx2.get('k', function(err, value){
    t.equal(value, 167, 'tx2 get equals 167');

    tx2.put('k', value+1);

    tx2.commit(function(err){
      db.get('k', function(err, value){
        t.equal(value, 168, 'db get equals 168');
      });
    });
  });

});

