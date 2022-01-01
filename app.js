const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "./twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const validatePassword = (password) => {
  return password.length > 5;
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "qwertyuiop", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (username, name, password, gender)
     VALUES
      (
       '${username}',
       '${name}',
       '${hashedPassword}',
       '${gender}'  
      );`;
    if (validatePassword(password)) {
      await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(getQuery);

  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "qwertyuiop");
      console.log({ jwtToken });
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getUserQuery = `SELECT user_id from user WHERE username='${username}';`;
  let getUserId = await db.get(getUserQuery);
  console.log(getUserId.user_id);

  const getFollowersQuery = `SELECT following_user_id from follower
               WHERE follower_user_id = ${getUserId.user_id};`;
  let getFollower = await db.all(getFollowersQuery);
  console.log(getFollower);
  const getFollowersId = getFollower.map((eachFollow) => {
    return eachFollow.following_user_id;
  });
  console.log(getFollowersId);

  const getTweetQuery = `SELECT user.username,tweet.tweet,tweet.date_time as dateTime from user 
  inner join tweet on user.user_id = tweet.user_id WHERE user.user_id in (${getFollowersId}) ORDER BY tweet.date_time desc limit 4;
  `;
  const tweetResult = await db.all(getTweetQuery);
  console.log(tweetResult);
  response.send(tweetResult);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  console.log(username);
  const getUserQuery = `SELECT user_id from user WHERE username='${username}';`;
  let getUserId = await db.get(getUserQuery);
  console.log(getUserId.user_id);

  const getFollowersQuery = `SELECT following_user_id from follower
               WHERE follower_user_id = ${getUserId.user_id};`;
  let getFollower = await db.all(getFollowersQuery);
  console.log(getFollower);
  const getFollowersId = getFollower.map((eachFollow) => {
    return eachFollow.following_user_id;
  });
  console.log(getFollowersId);

  const getTweetQuery = `SELECT Distinct user.name from user 
  inner join tweet on user.user_id in (${getFollowersId});
  `;
  const tweetResult = await db.all(getTweetQuery);
  console.log(tweetResult);
  response.send(tweetResult);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserQuery = `SELECT user_id from user WHERE username='${username}';`;
  let getUserId = await db.get(getUserQuery);
  console.log(getUserId.user_id);

  const getFollowingQuery = `SELECT follower_user_id from follower
               WHERE following_user_id = ${getUserId.user_id};`;
  let getFollowing = await db.all(getFollowingQuery);
  console.log(getFollowing);
  const getFollowingId = getFollowing.map((eachFollow) => {
    return eachFollow.follower_user_id;
  });
  console.log(getFollowingId);

  const getTweetQuery = `SELECT Distinct user.name from user 
  inner join tweet on user.user_id in (${getFollowingId});
  `;
  const tweetResult = await db.all(getTweetQuery);
  console.log(tweetResult);
  response.send(tweetResult);
});

const api6output = (tweetData, likesCount, repliesCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: repliesCount.reply,
    dateTime: tweetData.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const getUserQuery = `SELECT user_id from user WHERE username='${username}';`;
  let getUserId = await db.get(getUserQuery);

  const getFollowingQuery = `SELECT following_user_id from follower
               WHERE follower_user_id = ${getUserId.user_id};`;
  let getFollowing = await db.all(getFollowingQuery);

  const getFollowingId = getFollowing.map((eachFollow) => {
    return eachFollow.following_user_id;
  });

  const getTweetQuery = `SELECT tweet_id from tweet
  WHERE user_id in (${getFollowingId});`;
  const tweetResult = await db.all(getTweetQuery);
  const followingTweetId = tweetResult.map((followTweet) => {
    return followTweet.tweet_id;
  });

  if (followingTweetId.includes(parseInt(tweetId))) {
    const likesQuery = `SELECT count(user_id) as likes from like where tweet_id=${tweetId};`;
    const likesCount = await db.get(likesQuery);
    console.log(likesCount);
    const repliesQuery = `SELECT count(user_id) as reply from reply where tweet_id=${tweetId};`;
    const repliesCount = await db.get(repliesQuery);
    console.log(repliesCount);
    const tweetQuery = `SELECT tweet,date_time from tweet where tweet_id=${tweetId};`;
    const tweetData = await db.get(tweetQuery);
    console.log(api6output(tweetData, likesCount, repliesCount));
    response.send(api6output(tweetData, likesCount, repliesCount));
  } else {
    response.status(401);
    response.send("Invalid Request");
    console.log("Invalid Request");
  }
});

const arrayToStoreObject = (likedUser) => {
  return {
    likes: likedUser,
  };
};
app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserQuery = `SELECT user_id from user WHERE username='${username}';`;
    let getUserId = await db.get(getUserQuery);
    // console.log(getUserId.user_id);

    const getFollowingQuery = `SELECT following_user_id from follower
               WHERE follower_user_id = ${getUserId.user_id};`;
    let getFollowing = await db.all(getFollowingQuery);
    //  console.log(getFollowing);
    const getFollowingId = getFollowing.map((eachFollow) => {
      return eachFollow.following_user_id;
    });

    // console.log(getFollowingId);
    const getTweetQuery = `SELECT tweet_id from tweet
  WHERE user_id in (${getFollowingId});`;
    const tweetResult = await db.all(getTweetQuery);
    const followingTweetId = tweetResult.map((followTweet) => {
      return followTweet.tweet_id;
    });
    // console.log(followingTweetId);
    if (followingTweetId.includes(parseInt(tweetId))) {
      const likesQuery = `SELECT user.username as likes from user inner join like on user.user_id=like.user_id
       where like.tweet_id=${tweetId};`;
      const likesUser = await db.all(likesQuery);
      const getLikedUser = likesUser.map((eachUser) => {
        return eachUser.likes;
      });
      console.log(getLikedUser);
      console.log(arrayToStoreObject(getLikedUser));
      response.send(arrayToStoreObject(getLikedUser));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

const arrayToStoreObjectReplies = (dbObject) => {
  return {
    replies: dbObject,
  };
};
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getUserQuery = `SELECT user_id from user WHERE username='${username}';`;
    let getUserId = await db.get(getUserQuery);

    const getFollowingQuery = `SELECT following_user_id from follower
               WHERE follower_user_id = ${getUserId.user_id};`;
    let getFollowing = await db.all(getFollowingQuery);
    const getFollowingId = getFollowing.map((eachFollow) => {
      return eachFollow.following_user_id;
    });

    const getTweetQuery = `SELECT tweet_id from tweet
  WHERE user_id in (${getFollowingId});`;
    const tweetResult = await db.all(getTweetQuery);
    const followingTweetId = tweetResult.map((followTweet) => {
      return followTweet.tweet_id;
    });
    // console.log(followingTweetId);
    if (followingTweetId.includes(parseInt(tweetId))) {
      const repliesQuery = `SELECT user.name,reply.reply as reply from user inner join reply on user.user_id=reply.user_id
       where reply.tweet_id=${tweetId};`;
      const replyUser = await db.all(repliesQuery);
      console.log(replyUser);

      console.log(arrayToStoreObject(replyUser));
      response.send(arrayToStoreObjectReplies(replyUser));
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  // const { tweetId } = request.params;
  const { username } = request;
  const getUserQuery = `SELECT user_id from user WHERE username='${username}';`;
  let getUserId = await db.get(getUserQuery);
  console.log(getUserId);

  const getTweetQuery = `SELECT * from tweet WHERE user_id=${getUserId.user_id} order by tweet_id`;
  const getTweetArray = await db.all(getTweetQuery);
  const getTweetId = getTweetArray.map((eachId) => {
    return parseInt(eachId.tweet_id);
  });
  console.log(getTweetId);
  const getLikesQuery = `SELECT COUNT(like_id) as likes FROM like
  WHERE tweet_id IN (${getTweetId}) GROUP By tweet_id order by tweet_id;`;
  const likeObjectList = await db.all(getLikesQuery);
  console.log(likeObjectList);

  const getRepliesQuery = `SELECT COUNT(reply_id) as replies FROM reply
  WHERE tweet_id IN (${getTweetId}) GROUP By tweet_id order by tweet_id;`;
  const repliesObjectList = await db.all(getRepliesQuery);
  console.log(repliesObjectList);

  response.send(
    getTweetArray.map((tweetObj, index) => {
      const likes = likeObjectList[index] ? likeObjectList[index].likes : 0;
      const replies = repliesObjectList[index]
        ? repliesObjectList[index].replies
        : 0;
      return {
        tweet: tweetObj.tweet,
        likes,
        replies,
        dateTime: tweetObj.date_time,
      };
    })
  );
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const { username } = request;

  const userIdQuery = `SELECT user_id from user WHERE username = '${username}';`;
  const userId = await db.get(userIdQuery);
  console.log(userId.user_id);

  const currentDate = new Date();
  let date = currentDate.toISOString().replace("T", " ");

  const postQuery = `INSERT INTO tweet (tweet,user_id,date_time) values ('${tweet}',${userId.user_id},'${date}');`;
  const responsePost = await db.run(postQuery);
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    const userIdQuery = `SELECT user_id from user WHERE username = '${username}';`;
    const userId = await db.get(userIdQuery);
    //console.log(userId.user_id);

    const getTweetQuery = `SELECT tweet_id from tweet WHERE user_id=${userId.user_id};`;
    const getTweetIdArray = await db.all(getTweetQuery);
    let getTweetIds = getTweetIdArray.map((eachId) => {
      return eachId.tweet_id;
    });
    console.log(getTweetIds);
    if (getTweetIds.includes(parseInt(tweetId))) {
      const deleteQuery = `DELETE from tweet WHERE tweet_id = ${tweetId};`;
      await db.run(deleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
module.exports = app;
