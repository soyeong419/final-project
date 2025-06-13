const express = require('express'); //Express 모듈 불러오기
const router = express.Router(); //라우터 객체 생성
const { ObjectId } = require('mongodb'); //MongoDB의 ObjectId 객체 가져오기

//친구 추가 라우터
router.post('/friend/add', async (req, res) => {
    const db = req.db; //요청 객체에서 데이터베이스 핸들러 가져오기
    const myId = req.session.user?.userid; //현재 로그인한 사용자 id
    const friendId = req.body.friendid; //폼에서 전송된 친구 id 가져오기
    console.log("받은 friendId:", friendId);

    if (!myId || !friendId) return res.status(400).send("요청이 올바르지 않음");

    // 친구 userid로 친구 ObjectId 찾아오기
    const friend = await db.collection("account").findOne({ userid: friendId });
    console.log("찾은 친구 정보:", friend);
    if (!friend) return res.status(404).send("친구를 찾을 수 없습니다");

    //중복 없이 친구 추가
    await db.collection("account").updateOne(
        { userid: myId }, //내 계정을 찾고
        { $addToSet: { friends: friend.userid } } //freinds 배열에 해당 친구 id를 중복 없이 추가
    );
    console.log(`${friendId} 친구 추가 완료`);
    res.redirect('/friend/list'); //친구 목록 페이지로 이동
});

//친구 목록 조회 라우터
router.get('/friend/list', async (req, res) => {
  const db = req.db; //DB 핸들러 가져오기
  const myId = req.session.user?.userid; //현재 로그인한 사용자 id

  const me = await db.collection("account").findOne({ userid: myId }); //내 정보 불러오기
  const friendIds = me?.friends || []; //내 친구 id 목록 가져오기 (없을 시 빈 배열)

  // 친구들의 전체 정보 가져오기
  const friends = await db.collection("account")
    .find({ userid: { $in: friendIds } }) //친구 id 목록에 해당하는 계정들만 찾기
    .toArray(); //배열로 전환
  //friend_list.ejs 템플릿에 친구 리스트 넘기기
  res.render("friend_list.ejs", { friends }); 
});

//친구 게시물 목록 보기 라우터
router.get('/friend/:friendid/posts', async (req, res) => {
  const db = req.db;
  const myId = req.session.user?.userid;
  const friendId = req.params.friendid; //url 파라미터에서 친구 id 추출

  //현재 로그인한 사용자의 친구 목록 가져오기
  const me = await db.collection("account").findOne({ userid: myId });
  //사용자 친구가 아니면 접근 금지
  if (!me?.friends?.includes(friendId)) {
    return res.status(403).send("해당 사용자는 당신의 친구가 아닙니다.");
  }

  //해당 친구 게시물 최신순으로 가져오기
  const posts = await db.collection("post")
    .find({ userid: friendId }) //해당 친구가 작성한 게시물만
    .sort({ date: -1 }) //최신순으로 정렬
    .toArray(); //배열로 전환

  // 친구 계정 정보 가져오기
  const friend = await db.collection("account").findOne({ userid: friendId });
  //friend_list.ejs 템플릿에 친구 정보와 게시물 전달
  res.render("friend_posts.ejs", { friend, posts, friendId : friendId });
});


//메인 페이지(index)에서 최신 3개 게시물만 보여주는 라우터
router.get('/index', async (req, res) => {
    const db = req.db;

    // 게시물을 최신 3개만 가져오기 
    const posts = await db.collection("post")
        .find({}) //모든 게시물 검색
        .sort({ date: -1, _id: -1 })  //최신순 정렬. date 동일시 _id로 추가 정렬
        .limit(3)  // 최대 3개 제한
        .toArray();

    console.log("불러온 게시물 개수:", posts.length);  //불러온 게시물 수 확인
    console.log("불러온 게시물 내용:", posts);  //실제 불러온 게시물 출력

    res.render("index.ejs", { posts: posts }); //index.ejs 템플릿에 게시물 전달
});

module.exports = router; //라우터 모듈 외부로 내보내기
