'use strict';

/**
 * Redis schema of user
 *
 * user:[id]:name       User name
 * user:[id]:items      list of item id published by user
 * user:[id]:bids       list of bid id placed by user
 */

/**
 * Module dependencies.
 */
var redis = require('redis'),
    async = require('async'),
    redisClient = redis.createClient();

// get user name
var getUserName = function(id,callback) {
  redisClient.get('user:'+id+':name',function(err,name){
    callback(err,name);
  });
};

// get all item id published by user
var getUserItems = function(id,callback){
  redisClient.lrange(['user:'+id+':items',0,5],function(err,items){
    callback(err,items);
  });
};

// get list of item information owned by user
var getUserItemsInfo = function(id, callback){

  var item = require('./item.js');
  var itemsInfo = [];

  getUserItems(id,function(err, items){
    if(err) return callback(err);
    async.eachSeries(items,function(itemid, callback){
      item.getItemInfo(itemid,function(err,itemInfo){
        if (err) return callback(err);
        itemsInfo.push(itemInfo);
        callback();
      });
    },function(err){
      if(err) return callback(err);
      callback(err,itemsInfo);
    });
  });

};

// expose api
module.exports = {
  getUserName: getUserName,
  getUserItems: getUserItems,
  getUserItemsInfo: getUserItemsInfo
};
