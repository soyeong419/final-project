const express = require('express'); //Express 모듈 불러오기
const sha = require('sha256'); //sha256 해시 함수 모듈 불러오기
const router = express.Router(); //라우터 객체 생성


//로그인 페이지 출력 라우터
router.get('/login', (req, res)=>{
    console.log(req.session);
    if(req.session.user){ //user 정보가 있으면 로그인 상태로 판단
        console.log('세션 유지');
        res.render('login_success.ejs', //로그인 성공 페이지 렌더링
            { userid : req.session.user.userid,
                userpwd : req.session.user.userpwd
             });
    }
    else{ //없으면 로그인 폼 페이지 렌더링
        res.render('login.ejs');
    }
});

//'login' 요청에 대한 post 방식의 처리 루틴
router.post('/login', function(req, res){
    const db = req.db;
    const userid = req.body.userid; //입력한 아이디
    const userpwd = req.body.userpwd; //입력한 비밀번호
    console.log("아이디 : " + req.body.userid);
    console.log("비밀번호 : " + req.body.userpwd);
    //DB에서 아이디로 사용자 정보 검색
    db.collection('account').findOne({userid})
        .then((result) =>{ //DB에 저장된 암호화 비밀번호와 입력 비밀번호를 sha256 해시 후 비교
            if (result && result.userpwd === sha(req.body.userpwd)){ //비밀번호가 일치하면
                req.session.user = {userid : req.body.userid}; //사용자 정보 저장
                console.log('새로운 로그인');
                res.render('login_success.ejs', 
                    { userid : req.session.user.userid,
                        userpwd : req.session.user.userpwd
                    });
            }
            else{ //실패 시 다시 로그인 폼 렌더링
                res.render('login.ejs');
            }
        })
});

//로그아웃 처리 라우터
router.get('/logout', function(req, res){
    console.log('로그아웃');
    req.session.destroy(); //현재 세션을 파괴
    res.render('login.ejs', { user : null});
})

//회원가입 페이지 출력 라우터
router.get('/signup', function(req, res){
    res.render('signup.ejs'); //signup.ejs 파일 렌더링
});

//회원가입 처리 라우터
router.post('/signup', (req, res)=>{
    const db = req.db; //DB 핸들러 가져오기
    console.log(req.body.userid);
    console.log(sha(req.body.userpwd));
    console.log(req.body.usergroup);
    console.log(req.body.useremail);

    db.collection("account").insertOne({ //account 컬렉션에 새 사용자 데이터 추가
        userid: req.body.userid,
        userpwd: sha(req.body.userpwd), //암호화된 비밀번호
        usergroup: req.body.usergroup,
        useremail: req.body.useremail
    }).then(() => {
        console.log("회원가입 성공");
        res.render("login.ejs", {user:req.session.user}); //현재 세션 정보 전달
    });
});

module.exports = router; //라우터 모듈 외부로 내보내기

