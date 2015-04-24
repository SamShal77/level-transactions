var _         = require('underscore'),
    ginga     = require('ginga'),
    semaphore = require('./semaphore'),
    Queue     = require('./queue'),
    params    = ginga.params;

module.exports = function( db ){
  var mutex = {};

  function Transaction(opts){
    this.db = db;
    this.options = opts || {};

    this._released = false;

    this._taken = {};
    this._map = {};
    this._batch = [];
    
    Queue.call(this);

    if(typeof this.options.timeout === 'number'){
      var self = this;
      setTimeout(function(){
        if(!self._released)
          self.rollback(new Error('Transaction timeout.'));
      }, this.options.timeout);
    }
  }

  _.extend(Transaction.prototype, Queue.prototype);

  function pre(ctx, next, end){
    //options object
    ctx.options = _.defaults({}, ctx.params.opts, this.options);

    //check sublevel
    if(ctx.options && ctx.options.prefix && 
      typeof ctx.options.prefix.sublevel === 'function')
      ctx.prefix = ctx.options.prefix;

    //key + sublevel prefix hash
    ctx.hash = JSON.stringify(
      ctx.prefix ? 
      [ctx.prefix.prefix(), ctx.params.key] : 
      ctx.params.key
    );

    this.defer(function(cb){
      next();
      end(cb);
    });
  }

  function lock(ctx, next, end){
    if(this._released)
      return next(this._error || new Error('Transaction released.'));

    if(this._taken[ctx.hash]){
      next();
    }else{
      //gain mutually exclusive access to transaction
      var self = this;
      var mu = mutex[ctx.hash] = mutex[ctx.hash] || semaphore(1);
      mu.take(function(){
        if(self._released){
          mu.leave();
          return;
        }
        self._taken[ctx.hash] = true;
        next();
      });
    }
  }

  function get(ctx, done){
    if(ctx.hash in this._map){
      done(null, this._map[ctx.hash]);
      return;
    }
    var self = this;

    (ctx.prefix || db).get(ctx.params.key, _.defaults(
      {}, ctx.params.opts, this.options
    ), function(err, val){
      self._map[ctx.hash] = val;
      done(err, val);
    });
  }

  function put(ctx, done){
    this._batch.push(_.defaults({
      type: 'put',
      key: ctx.params.key,
      value: ctx.params.value
    }, ctx.options));

    this._map[ctx.hash] = ctx.params.value;

    done(null);
  }

  function del(ctx, done){
    this._batch.push(_.defaults({
      type: 'del',
      key: ctx.params.key
    }, ctx.options));

    this._map[ctx.hash] = undefined;

    done(null);
  }

  function commit(ctx, next, end){
    var self = this;

    this.done(function(err){
      if(err)
        return next(err);
      db.batch(self._batch, function(err, res){
        if(err) next(err); 
        else next();
      });
    });

    end(function(err){
      //rollback on commit error
      if(err)
        self.rollback();
    });
  }

  //release after rollback, commit
  function release(ctx, done){
    if(this._released)
      return done(this._error || new Error('Transaction released.'));

    if(ctx.params && ctx.params.error)
      this._error = ctx.params.error;

    _.each(this._taken, function(t, hash){
      mutex[hash].leave();
      if(mutex[hash].empty())
        delete mutex[hash];
    });

    delete this._taken;
    delete this._map;
    delete this._batch;

    this._released = true;

    done(this._error);
  }

  ginga(Transaction.prototype)
    .define('get', params('key','opts?'), pre, lock, get)
    .define('put', params('key','value','opts?'), pre, lock, put)
    .define('del', params('key','opts?'), pre, lock, del)
    .define('rollback', params('error?'), release)
    .define('commit', commit, release);

  db.transaction = db.transaction || function(options){
    return new Transaction(options);
  };
  return db;
};
