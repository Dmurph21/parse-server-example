


Parse.Cloud.beforeSave("Notification", function(request, response) {
    var notify = request.object;
    var sentFrom = notify.get("SentFrom")
    var user = notify.get("User")
    var message = notify.get("Message")
    var query = new Parse.Query(Parse.Installation);
    if (notify.get("Accepted")) {
	sentFrom.increment("friendAccepted");
    	sentFrom.save()
    	query.equalTo('User',sentFrom);
    	Parse.Push.send({where: query, data: {
		alert : message,
        	ObjID : user.id,
        	inviteID : notify.id,
        	badge: 'Increment',
        	type : 'friendAccepted' 
    	}}, {
  		success: function() {     
        	response.success()
		//notify.delete()
    	}, error: function(error) {
    		// Handle error
    		response.error("could not create publisher token for activeSession: " + activeSession.id);
    	}});
    } else {
    	user.increment("friendInvite");
    	user.save()
    	query.equalTo('User',user);
    	Parse.Push.send({where: query, data: {
		alert : message,
        	ObjID : sentFrom.id,
        	inviteID : notify.id,
        	badge: 'Increment',
        	type : 'friendInvite' 
    	}}, {
  		success: function() {     
        	response.success()
    	}, error: function(error) {
    		// Handle error
    		response.error("could not create publisher token for activeSession: " + activeSession.id);
    	}}); 
    }
});

var opentok = require('cloud/opentok/opentok.js').createOpenTokSDK('45441312', '1989c73f04fe3a4d1948a25555fd84ea7905bae6');

// Every ActiveSessions object should "own" an OpenTok Session
Parse.Cloud.beforeSave("ActiveSessions", function(request, response)
{
    var activeSession = request.object;
    // If this ActiveSessions already has a sessionId, we are done
    if (activeSession.get("sessionID")) { response.success(); 
	return;
    }
  
    // Otherwise, we create a Session now...
    opentok.createSession(function(err, sessionId)
    {
	// Handle any errors
        if (err)
        {
            response.error("could not create opentok session for activeSession: " + activeSession.id);
            return;
        }
        // ... and now save the sessionId in the ActiveSessions object
        activeSession.set("sessionID", sessionId);     
         
        //now, generate the token please...
        var publisherToken = opentok.generateToken(sessionId, { "role" : opentok.ROLE.PUBLISHER });
        if (publisherToken) 
        {
        }
        else
        {
            response.error("could not create publisher token for activeSession: " + activeSession.id);
            return;
        }
         
        var subscriberToken = opentok.generateToken(sessionId, { "role" : opentok.ROLE.SUBSCRIBER });
        if (subscriberToken) 
        {
        }
        else
        {
            response.error("could not create publisher token for activeSession: " + activeSession.id);
            return;
        }
        // ... and now save the sessionId in the ActiveSessions object
        activeSession.set("publisherToken", publisherToken);
        activeSession.set("subscriberToken", subscriberToken);     
        response.success();
	    if (activeSession.get("receiver")) { 
		var query = new Parse.Query(Parse.Installation);
		var receiver = activeSession.get("receiver")
		receiver.increment("gameInvite");
      		receiver.save()
		var caller = activeSession.get("caller")
		var callerTitle = activeSession.get("callerTitle")
		query.equalTo('User',receiver);
		Parse.Push.send({where: query, data: {
			alert : callerTitle,
        		ObjID : caller.id,
        		badge: 'Increment',
			gameID: activeSession.id,
        		type : 'gameInvite' 
    		}}, {
  			success: function() {     
        		response.success()
   	        }, error: function(error) {
    			// Handle error
    			response.error("could not create publisher token for activeSession: " + activeSession.id);
    		}}); 
    	}
});
});
  
  
// This function can be called by any user who wants to connect to a ActiveSessions and a Token with the
// corresponding `role` will be generated. (Publisher for the ActiveSessions owner, Subscriber for anyone else)
Parse.Cloud.define("getActiveSessionsToken", function(request, response) {
    // Retrieve the ActiveSessions object for which the token is being requested
    var activeSessionId = request.params.activeSession;
    if (!activeSessionId) response.error("you must provide a activeSession object id");
    var activeSessionQuery = new Parse.Query("ActiveSessions");
    activeSessionQuery.get(activeSessionId, {
        // When the ActiveSessions object is found...
        success: function(activeSession) {
            // Get the appropriate role according to the user who is calling this function
            var role = roleForUser(activeSession, request.user);
            // Create a Token
            var token = opentok.generateToken(activeSession.get("sessionID"), { "role" : role });
            // Return the token as long as it exists
            if (token) {
                response.success(token);
                // Handle errors
            } else {
                response.error("could not generate token for activeSession id: " + activeSessionId + " for role: " + role);
            }
        },
        // When the ActiveSessions object is not found, respond with error
        error: function(activeSession, error) {
            response.error("cannot find activeSession with id: " + activeSessionId);
        }
    });
});
  

var roleForUser = function(activeSession, user) {
    // A ActiveSessions owner gets a Publisher token
    var caller = activeSession.get("caller") 
    if (caller.id === user.id) {
        return opentok.ROLE.PUBLISHER;
        // Anyone else gets a Subscriber token
    } else {
        return opentok.ROLE.SUBSCRIBER;
    }
};
