"use strict";

var express = require('express');
var app = express();

var path = require('path');

var redis = require('redis'),
    redisClient = redis.createClient();

var async = require('async');

app.set('view engine', 'jade');

app.set('views', path.join(__dirname, 'views'));

app.use(express.bodyParser());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/user/:uid/items',function(req, res){

    var uid = req.params.uid;

    var user = require('./models/user.js');

    var data = {"uid": uid};


    user.getUserName(uid,function(err, name){
        if(err) return callback(err);
        data.username = name;
        res.render("user_items", data);
    });

});

app.get('/api/:uid/items',function(req, res){
    var uid = req.params.uid;
    var user = require('./models/user.js');

    user.getUserItemsInfo(uid,function(err, items){
        if (err) return console.log(err);
        res.json(items);
    });
});

app.post('/api/:uid/createItem',function(req, res){
    var uid = req.params.uid;

    var itemName = req.body.itemName;
    var itemReservedPrice = req.body.itemReservedPrice;

    var item = require('./models/item.js');

    item.newItem(uid,itemName,itemReservedPrice,function(err, item){
         res.json(item);
    });
});

app.put('/api/:uid/bidItem', function(req, res){
    var uid = req.params.uid;

    var itemId = req.body.itemId;
    var price = req.body.price;

    var item = require('./models/item.js');

    item.bidUp(itemId,uid,price,function(err,success){
        if (err) return console.log(err);
        res.json({'success': success});
    });
});

app.put('/api/:itemId/closeItem', function(req, res){
    var itemId = req.params.itemId;
    var uid = req.body.uid;

    var item = require('./models/item.js');

    item.closeItem(itemId, uid, function(err, response){
        if (err) return console.log(err);
        res.json(response);
    });

});

app.get('/api/:itemId/itemHistory', function(req, res){

    var itemId = req.params.itemId;

    var item = require('./models/item.js');

    item.getHistory(itemId, function(err, history){
        if (err) return console.log(err);
        res.json(history);
    });

});

app.listen(3001);

