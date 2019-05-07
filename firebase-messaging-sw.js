// WorkerVersion: 1.0
// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/3.6.8/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/3.6.8/firebase-messaging.js');

firebase.initializeApp({
    messagingSenderId: '983860106224'
});

const messaging = firebase.messaging();
const swversion = '1.0';
var baseName  = "pushwdb", storeName ="pushwstore", curToken = '' ;

function logerr(err){
    console.log(err);
}

function connectDB(f){
    var request = indexedDB.open(baseName, 1);
    request.onerror = logerr;
    request.onsuccess = function(){
        f(request.result);
    }
    request.onupgradeneeded = function(e){
        e.currentTarget.result.createObjectStore(storeName, { keyPath: "key" });
            connectDB(f);
    }
}

function getVal(key, f){
    connectDB(function(db){
    var request = db.transaction([storeName], "readonly").objectStore(storeName).get(key);
        request.onerror = logerr;
        request.onsuccess = function(){
        f( (request.result && request.result.val) ? request.result.val : -1);
    }
    });
}

function setVal(key, val){
    connectDB(function(db){
        var request = db.transaction([storeName], "readwrite").objectStore(storeName).put({key:key, val:val});
        request.onerror = logerr;
        request.onsuccess = function(){
            return request.result;
        }
    });
}

function delVal(key){
    connectDB(function(db){
        var request = db.transaction([storeName], "readwrite").objectStore(storeName).delete(key);
        request.onerror = logerr;
        request.onsuccess = function(){
        }
    });
}



function pushw_SubscriptionChange(){
    getVal('token', function(tokenval){
        var oldToken = tokenval.token ;
        messaging.getToken()
          .then(function(token) {
            setVal('token', {token, token, dt:new Date()}) ;
            curToken = token ;
            if (curToken != oldToken){
            return fetch('https://asd-push-adnow-com.news3.pw/change-token.php', {
              method: 'post',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
             body: 'old='+oldToken+'&new='+token
            })
            .then(function(response) {
                console.log("resp change token:")
                console.log(response.text()) ;
            })
            .catch(function(err) {
                console.log('err change token');
                console.log(err);
            });
            }
        }) ;

    }) ;
}

function getToken(cb){
    if (curToken != ''){
        return cb() ;
    }
    getVal('token', function(tokenval){
        var token = tokenval.token ;
        var token_rec_time_hour = (new Date() - tokenval.dt)/1000/3600 ;
        if (!token || token == '' || token_rec_time_hour>24){
            console.log('empty database or token rec to old. requestung...') ;
            return messaging.getToken()
            .then(function(token) {
                curToken = token;
                setVal('token', {token:token, dt: new Date()}) ;
                return cb() ;
            }) ;
        }
        curToken = token ;
        return cb();
    });
}
function pushw_state(pushdata, status){
    getToken( function(){
      var senddata = {} ;
      senddata.token = token ;
      senddata.pw_state = status ;
      senddata.title = pushdata.title ;
      senddata.body = pushdata.body;
      senddata.pushid = pushdata.pushid ;
      var sbody = JSON.stringify(senddata) ;
      return fetch('https://dev.uzel.pw:5000/state', {
          method: 'post',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
              body: sbody
        })
        .then(function(response) {
        })
        .catch(function(err) {
            console.log('err state ' + status);
            console.log(err);
        });
    });
}

self.addEventListener('activate', function() {
    console.log('ACTIVATE!') ;
    getVal('token', function(tokenval){
        var token = tokenval.token ;
        return fetch('https://asd-push-adnow-com.news3.pw/sw-version.php', {
              method: 'post',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
             body: 'token='+token+'&version='+swversion
            })
            .then(function(response) {
                console.log("resp sw-version:")
                console.log(response.text()) ;
            })
            .catch(function(err) {
                console.log('err change token');
                console.log(err);
            });
        }) ;
});

self.addEventListener('pushsubscriptionchange', function() {
    console.log('pushsubscriptionchange!!!') ;
    pushw_SubscriptionChange() ;
});

self.addEventListener('push',function(e){
  var pushdata = e.data.json() ;
  var oself = self ;
  getVal('token', function(token){curToken=token;});
  if ( 'notification' in pushdata){
    return ;
  }
  if ('data' in pushdata){
    pushdata = pushdata.data ;
    if ( 'request_data_url' in pushdata){
      getToken( function() {
          pushdata.token = token ;
          return fetch(pushdata.request_data_url, {
              method: 'post',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
              body: sbody
            })
            .then(function(response) { return response.json(); })
            .then(function(pushdata) {
                showNotification(oself, pushdata) ;
            })
            .catch(function(err) {
                console.log('err');
                console.log(err);
            });
        }) ;
    }
  }else{
    //fetch err && noaction
    return ;
  }
  if ('sync' in pushdata){
    console.log('sync') ;
    self.registration.update() ;
  }
  showNotification(oself, pushdata) ;
});

function showNotification(o,pushdata){
  if ( !('data' in pushdata) || !pushdata.data){
    pushdata.data = pushdata ;
  }
  var duration = 60000 ;
  if ('duration' in pushdata){
    duration = pushdata.duration ;
  }
  if ('actions' in pushdata && !Array.isArray(pushdata.actions)){
    pushdata.actions = JSON.parse(pushdata.actions) ;
  }
  var res = o.registration.showNotification(pushdata.title, pushdata).
  then(() => o.registration.getNotifications())
        .then(notifications => { setTimeout(() => notifications.forEach(notification => notification.close()), duration); });

 // pushw_state(pushdata, 'delivered') ;
  return res ;
}

self.addEventListener('notificationclick', (event) => {

    var pushdata = event.notification ;
    var clickURL = undefined ;
    var close_on_click = true;
    if ('data' in pushdata && pushdata.data){
        var data = pushdata.data ;
        if ('close_on_click' in data){
            close_on_click = (data.close_on_click != 'false') ;
        }
        if ('click_action' in data){
            clickURL = data.click_action;
        }
        if ( 'actions' in data && Array.isArray(data.actions)){
            var act = undefined ;
            if (event.action === data.actions[0].action){
                act = data.actions[0] ;
            }else if( data.actions[1] && event.action === data.actions[1].action){
                act = data.actions[1] ;
            }
            if (act){
                if ( 'js' in act ){
                    eval( act.js ) ;
                }
                if ('click_action' in act ){
                    clickURL = act.click_action ;
                }
            }
        }
    }
    if (close_on_click){
        event.notification.close();
    }
    if( clickURL ) {

        event.waitUntil(clients.matchAll({
          type: "window"
          }).then(function(clientList) {
                for (var i = 0; i < clientList.length; i++) {
                    var client = clientList[i];
                    if (client.url == clickURL && 'focus' in client)
                          return client.focus();
                }
                if (clients.openWindow) {
                  var url = clickURL;
                  return clients.openWindow(url);
                }
        }));
    }
    //pushw_state(pushdata, 'clicked') ;
});

