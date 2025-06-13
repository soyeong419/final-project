const express = require('express'); //Express 모듈 불러오기
const router = express.Router(); //라우터 객체 생성

//친구 목록에서 최근 게시물 3개 조회 및 렌더링
router.get('/index', async function(req, res){
    const user = req.session.user || null; //로그인한 사용자 정보 가져오기
    if (!user) { //로그인 상태 확인
        return res.redirect('/login');
    }

    const db = req.db; //DB 핸들러 가져오기
    const myId = user.userid; //현재 로그인한 사용자 id 저장

    //현재 사용자 계정 정보 불러오기
    const me = await db.collection("account").findOne({ userid: myId });
    const friends = me.friends || []; //친구 목록 가져오기. 없으면 빈 배열

    //친구들 게시물 중 최신 게시물 3개 가져오기
    const posts = await db.collection("post")
        .find({ userid: { $in: friends } }) //친구들 중 하나라도 쓴 게시물만
        .sort({ date: -1 })  //최신순 정렬
        .limit(3)  //최대 3개 제한
        .toArray(); //배열로 반환

    //실제 가져온 게시물 출력
    console.log("친구들의 게시물:", posts);

    //'index.ejs'에 사용자 정보와 게시물을 전달
    res.render("index.ejs", {
        user: req.session.user, //현재 로그인한 사용자 정보 전달
        posts: posts  //친구들 최신 게시물 리스트 전달
    });
});

//검색 기능
router.get('/search', (req, res) => {
    //쿼리스트링에서 검색어를 받아 /list?value= 검색어로 리디렉션
    res.redirect('/list?value=' + encodeURIComponent(req.query.value || ''));
});

module.exports = router; //라우터 모듈 외부로 내보내기

