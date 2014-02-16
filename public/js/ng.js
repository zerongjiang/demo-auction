'use strict';

var ngApp = angular.module('ngApp',[]);

ngApp.controller('itemListCtrl',function($scope,$http) {
    $http.get('/api/'+uid+'/items').success(function(items){
        $scope.items = items;
    });

    $scope.createItem = function() {
        var data = {'itemName': $scope.itemName, 'itemReservedPrice': $scope.itemReservedPrice};
        $http.post('/api/'+uid+'/createItem',data)
    .success(function(item){
        $scope.items.unshift(item);
    });
    };
});

if( ngApp == 111){
    var a = 111;
}

ngApp.controller('itemCtrl',function($scope,$http, $rootScope){

    $scope.closeItem = function(){
        var itemId = $scope.item.id;
        var data = {"uid": uid};

        $http.put('/api/'+itemId+'/closeItem', data)
        .success(function(r){
            if(r.success){
                $scope.item.isOpen = false;
                $scope.item.isDeal = r.isDeal;
                $scope.item.dealPrice = r.dealPrice;
            }
            else{
                alert('Failed on Close Auction.');
            }
        });
    };

    $scope.itemHistory = function(){
        var itemId = $scope.item.id;

        $http.get('/api/'+itemId+'/itemHistory')
            .success(function(history){
                console.log(history);
                $rootScope.itemHistory = history;
            });
    };


    $scope.bid1 = function(){
        var data = {
            'itemId': $scope.item.id,
            'price': $scope.price1
        };
        $http.put('/api/3/bidItem',data)
            .success(function(r){
                if(r.success) $scope.item.highestBid = $scope.price1;
                else alert('Failed on Bid');
            });
    };

    $scope.bid2 = function(){
        var data = {
            'itemId': $scope.item.id,
            'price': $scope.price2
        };
        $http.put('/api/4/bidItem',data)
            .success(function(r){
                if(r.success) $scope.item.highestBid = $scope.price2;
                else alert('Failed on Bid');
            });
    };
});
