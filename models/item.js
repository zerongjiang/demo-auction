'use strict';

/**
 * Redis schema of item
 *
 * gloabal:nextItemId       generate new item id
 * item:[id]:name           name of auction item
 * item:[id]:reservedPrice  reserved price of auction item
 * item:[id]:userid         user id who created the item
 * item:[id]:isOpen         1 for open, 0 for closed
 * item:[id]:isDeal         1 for deal, 0 for failed on deal
 * item:[id]:bids           list of bid id associated to this item
 */

/**
 * Module dependencies.
 */
var redis = require('redis'),
    async = require('async'),
    redisClient = redis.createClient();

// Get item name
var getItemName = function(itemId,callback){
    redisClient.get('item:'+itemId+':name',function(err,name){
        callback(err,name);
    });
};

// Get item reserved price
var getItemReservedPrice = function(itemId,callback){
    redisClient.get('item:'+itemId+':reservedPrice',function(err,reservedPrice){
        callback(err,parseFloat(reservedPrice));
    });
};

// Get user id who published item
var getItemUserid = function(itemId,callback){
    redisClient.get('item:'+itemId+':userid',function(err,userid){
        callback(err,userid);
    });
};

// check if item is on auction
var isOpen = function(itemId, callback){
    redisClient.get('item:'+itemId+':isOpen',function(err,isOpen){
        isOpen = parseInt(isOpen) === 1 ? true : false;
        callback(err,isOpen);
    });
};

// check if item deal successfully
var isDeal = function(itemId, callback){
    redisClient.get('item:'+itemId+':isDeal',function(err,isDeal){
        isDeal = parseInt(isDeal) === 1 ? true : false;
        callback(err,isDeal);
    });
};

// check deal price of item if there's any
var getDealPrice = function(itemId, callback){
    redisClient.get('item:'+itemId+':dealPrice',function(err,dealPrice){
        callback(err,dealPrice);
    });
};

// check if uid is the owner of an item
var isOwner = function(itemId,uid,callback){
    redisClient.get('item:'+itemId+':userid',function(err,userid){
        var isOwner = uid == userid ? true : false;
        callback(err,isOwner);
    });
};

// find all bid id on item
var getBidsId = function(itemId,callback){
    redisClient.lrange(['item:'+itemId+':bids',0,-1], function(err,bidsId){
        callback(err,bidsId);
    });
};

// get highest bid id on item
var getHighestBidId = function(itemId,callback){
    redisClient.lrange(['item:'+itemId+':bids',0,0], function(err,bidId){
        if(typeof bidId !== 'undefined') bidId = bidId[0];
        callback(err,bidId);
    });
};

// get highest bid price
var getHighestBid = function(itemId,callback){
    var bid = require('./bid.js');
    var highestBid = 0;
    async.waterfall([
        function(callback){
            getHighestBidId(itemId, function(err, bidId){
                if(err) return callback(err);
                callback(null,bidId);
            });
        },
        function(bidId, callback){
            if(typeof bidId === 'undefined') return callback();
            bid.getBidPrice(bidId, function(err,price){
                if(err) return callback(err);
                highestBid = price;
                callback();
            });
        }
    ],
    function(err, results){
        callback(err,highestBid);
    });
};

// wrap item information in an object
var getItemInfo = function(itemId,callback){

    var itemData = {'id': itemId};
    async.parallel([
        function(callback){
            getItemName(itemId,function(err,name){
                if (err) return callback(err);
                itemData.name = name;
                callback();
            });
        },
        function(callback){
            getItemUserid(itemId,function(err, userid){
                if (err) return callback(err);
                itemData.userid = userid;
                callback();
            });
        },
        function(callback){
            // check if item still on auction
            isOpen(itemId, function(err,isOpen){
                if (err) return callback(err);
                itemData.isOpen = isOpen;
                // if on auction find highest bid price
                if(isOpen){
                    getHighestBid(itemId, function(err,highestBid){
                        if (err) return callback(err);
                        itemData.highestBid = highestBid;
                        callback();
                    });
                }
                // if closed find deal information
                else{
                    isDeal(itemId, function(err, isDeal){
                        if (err) return callback(err);
                        itemData.isDeal = isDeal;
                        if(isDeal){
                            getDealPrice(itemId, function(err,dealPrice){
                                if (err) return callback(err);
                                itemData.dealPrice = dealPrice;
                                callback();
                            });
                        }
                        else{
                            callback();
                        }
                    });
                }
            });
        }
    ],
    function(err, results){
        callback(err,itemData);
    });
};

// place new bid on item
var bidUp = function(itemId,uid,price,callback){

    var bid = require('./bid.js');
    var success = false;

    // watch keys for atomic operation on adding new bid
    redisClient.watch('global:nextBidId');
    redisClient.watch('item:'+itemId+':bids');
    redisClient.watch('item:'+itemId+':dealPrice');
    redisClient.watch('item:'+itemId+':isOpen');
    redisClient.watch('user:'+uid+':bids');

    async.waterfall([
        // check item is on auction
        function(callback){
             isOpen(itemId,function(err, isOpen){
                if(err) return callback(err);
                callback(null,isOpen);
            });
        },
        // get highest bid price
        function(isOpen,callback){
            if(isOpen){
                getHighestBid(itemId, function(err, highestBid){
                    if(err) return callback(err);
                    if(price > highestBid){
                        callback(null,true);
                    }
                    else{
                        callback(null,false);
                    }
                });
            }
            else{
                callback(null, false);
            }
        },
        // make sure offer is larger than highest bid
        function(isLarger,callback){
            if(isLarger){
                // get next bid id
                redisClient.get('global:nextBidId',function(err, nextBidId){
                    if (err) return callback(err);
                    nextBidId++;

                    // add the new legal bid
                    var multi = redisClient.multi();
                    multi.set('global:nextBidId', nextBidId, function(err, res){
                        if (err) return callback(err);
                    })
                    .set('bid:'+nextBidId+':itemid', itemId, function(err, res){
                        if (err) return callback(err);
                    })
                    .set('bid:'+nextBidId+':userid', uid, function(err, res){
                        if (err) return callback(err);
                    })
                    .set('bid:'+nextBidId+':price', price, function(err, res){
                        if (err) return callback(err);
                    })
                    .lpush(['user:'+uid+':bids',nextBidId], function(err, res){
                        if (err) return callback(err);
                    })
                    .lpush(['item:'+itemId+':bids',nextBidId], function(err, res){
                        if (err) return callback(err);
                    });

                    multi.exec(function(err, res){
                        if (err) return callback(err);
                        success = true;
                        callback();
                    });
                });
            }
            else{
                callback();
            }
        }
    ],function(err,results){
        callback(err,success);
    });

};

// close the auction
var closeItem = function(itemId, uid, callback){

    var response = {
        'success': false
    };

    isOwner(itemId, uid, function(err, isOwner){
        if(err) return callback(err);
        // only owner can close it
        if(isOwner){
            isOpen(itemId, function(err, isOpen){
                if(err) return callback(err);
                if(isOpen){
                    // watch keys, dont allow new bids
                    redisClient.watch('item:'+itemId+':isOpen');
                    redisClient.watch('item:'+itemId+':dealPrice');
                    redisClient.watch('item:'+itemId+':bids');

                    getHighestBid(itemId, function(err, highestBid){
                        if(err) return callback(err);
                        getItemReservedPrice(itemId, function(err, reservedPrice){
                            if(err) return callback(err);
                            var dealPrice, isDeal;
                            if(highestBid > reservedPrice){
                                dealPrice = highestBid;
                                isDeal = 1;
                            }
                            else{
                                dealPrice = 0;
                                isDeal = 0;
                            }
                            // add deal information
                            var multi = redisClient.multi();
                            multi.set('item:'+itemId+':isOpen', 0, function(err, res){
                                if(err) return callback(err);
                            })
                            .set('item:'+itemId+':dealPrice', dealPrice, function(err, res){
                                if(err) return callback(err);
                            })
                            .set('item:'+itemId+':isDeal', isDeal, function(err, res){
                                if(err) return callback(err);
                            });

                            multi.exec(function(err, res){
                                response.success = true;
                                response.isDeal = isDeal == 1 ? true : false;
                                response.dealPrice = dealPrice;
                                callback(err, response);
                            });

                        });
                    });

                }
                else{
                    callback(null, response);
                }
            });
        }
        else{
            callback(null, response);
        }
    });
};

// publish new item
var newItem = function(uid,name,reservedPrice,callback){

    redisClient.watch('global:nextItemId');
    redisClient.watch('user:'+uid+':items');

    var item = {
        'name': name,
        'uid': uid,
        'highestBid': 0,
        'isOpen': true
    };

    redisClient.get('global:nextItemId', function(err, nextItemId){
        if(err) return callback(err);

        nextItemId++;

        var multi = redisClient.multi();

        multi.set('global:nextItemId', nextItemId, function(err, res){
            if(err) return callback(err);
        })
        .set('item:'+nextItemId+':name', name, function(err, res){
            if(err) return callback(err);
        })
        .set('item:'+nextItemId+':reservedPrice', reservedPrice, function(err, res){
            if(err) return callback(err);
        })
        .set('item:'+nextItemId+':isOpen', 1, function(err, res){
            if(err) return callback(err);
        })
        .set('item:'+nextItemId+':userid', uid, function(err, res){
            if(err) return callback(err);
        })
        .lpush(['user:'+uid+':items',nextItemId],function(err, res){
            if(err) return callback(err);
        });

        multi.exec(function(err, res){
            item.id = nextItemId;
            callback(err, item);
        });

    });
};

// get bid history of an item
var getHistory = function(itemId, callback){
    var history = {};

    async.parallel([
        function(callback){
            getItemName(itemId, function(err, name){
                if(err) return callback(err);
                history.name = name;
                callback();
            });
        },
        function(callback){
            isOpen(itemId,function(err, isOpen){
                if(err) return callback(err);
                history.isOpen = isOpen;
                callback();
            });
        },
        function(callback){
            getDealPrice(itemId, function(err, dealPrice){
                if(err) return callback(err);
                history.dealPrice = dealPrice;
                callback();
            });
        },
        function(callback){
            isDeal(itemId, function(err, isDeal){
                if(err) return callback(err);
                history.isDeal = isDeal;
                callback();
            });
        },
        function(callback){
            getBidsId(itemId, function(err, bidsId){
                var bid = require('./bid.js');
                history.bids = [];
                async.eachSeries(bidsId, function(bidId, callback){
                    bid.getBidInfo(bidId, function(err, bidData){
                        history.bids.push(bidData);
                        callback();
                    });
                },function(err){
                    if(err) return callback(err);
                    callback();
                });

            });
        }
    ],
    function(err, results){
        if (err) return callback(err);
        callback(null, history);
    });
};

// expose api
module.exports = {
    getItemName: getItemName,
    getItemReservedPrice: getItemReservedPrice,
    getItemUserid: getItemUserid,
    getItemInfo: getItemInfo,
    bidUp: bidUp,
    newItem: newItem,
    closeItem: closeItem,
    getHistory: getHistory
};
