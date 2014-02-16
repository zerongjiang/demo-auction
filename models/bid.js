'use strict';

/**
 * Redis schema of bid
 *
 * global:nextBidId     generate next bid id
 * bid:[id]:itemid      associated item id of bid
 * bid:[id]:price       bid price of bid
 * bid:[id]:userid      user id who placed bid
 */

/**
 * Module dependencies.
 */

var redis = require('redis'),
    async = require('async'),
    redisClient = redis.createClient();

// Get price of an bid
var getBidPrice = function(id,callback){
    redisClient.get('bid:'+id+':price', function(err,price){
        callback(err,parseFloat(price));
    });
};

// Get user id placed an bid
var getBidUserid = function(id,callback){
    redisClient.get('bid:'+id+':userid', function(err,userid){
        callback(err,userid);
    });
};

// Get user name who placed an bid
var getBidUserName = function(id, callback){
    getBidUserid(id, function(err, userid){
        if(err) return callback(err);
        var user = require('./user.js');
        user.getUserName(userid, function(err, username){
            if(err) return callback(err);
            callback(err,username);
        });
    });
};

/**
 * Wrap bid information in object
 * {
 *      'bidId':    id,
 *      'price':        price,
 *      'userid':       userid,
 *      'username':     username
 * }
 */
var getBidInfo = function(id, callback){
    var bidData = {
        'bidId' : id
    };
    // Parallel getting information
    async.parallel([
        function(callback){
            getBidUserid(id,function(err, userid){
                if(err) return callback(err);
                bidData.userid = userid;
                callback();
            });
        },
        function(callback){
            getBidUserName(id,function(err, username){
                if(err) return callback(err);
                bidData.username = username;
                callback();
            });
        },
        function(callback){
            getBidPrice(id,function(err, price){
                if(err) return callback(err);
                bidData.price = price;
                callback();
            });
        },
    ],
    function(err, results){
        callback(err, bidData);
    });
};

// expose api
module.exports = {
    getBidPrice: getBidPrice,
    getBidUserid: getBidUserid,
    getBidUserName: getBidUserName,
    getBidInfo: getBidInfo
};
