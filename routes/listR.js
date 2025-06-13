const express = require('express'); //Express 모듈 불러오기
const router = express.Router(); //라우터 객체 생성
const multer = require('multer'); //파일 업로드를 위한 Multer 모듈 불러오기
const iconv = require('iconv-lite'); //문자 인코딩을 다루기 위한 iconv-lite 불러오기
const fs = require('fs'); //파일 시스템 관련 모듈 불러오기
const path = require('path'); //경로 관련 모듈 불러오기
const ObjId = require('mongodb').ObjectId;

//Multer 저장소 설정
let storage = multer.diskStorage({
    destination : function(req, file, done){ //업로드된 파일의 저장 경로 설정
        done(null, './public/image'); //public/image 폴더에 저장
    },
    filename : function(req, file, done){ //업로드된 파일의 이름 설정 
        //latin1으로 디코딩한 뒤 다시 UTF-8로 디코딩
        const originalnameBuffer = Buffer.from(file.originalname, 'latin1');
        const utf8Name = iconv.decode(originalnameBuffer, 'utf8');
        done(null, utf8Name); //디코딩된 파일명 저장
    }
})
//Multer 설정을 적용한 upload 미들웨어 생성
const upload = multer({ storage: storage });

//게시물 목록 페이지 출력 라우터
router.get('/list', async function(req, res){
    const db = req.db; //DB 핸들러 가져오기
    const sessionUser = req.session.user; //현재 로그인한 사용자 id

    if (!sessionUser || !sessionUser.userid) { //로그인하지 않은 경우
        return res.status(401).send(`
            <html>
            <head>
                <meta charset="UTF-8" />
                <title>로그인 필요</title>
                <script>
                setTimeout(function() {
                    window.location.href = '/login'; // 로그인 페이지 경로에 맞게 수정하세요
                }, 3000);
                </script>
            </head>
            <body>
                <h1>로그인 후 글을 작성할 수 있습니다.</h1>
                <p>3초 후에 로그인 페이지로 이동합니다.</p>
            </body>
            </html>
        `);
    }
  try {
    const query = {userid: sessionUser.userid}; //로그인한 사용자의 글만 검색
    if (req.query.value) { //검색어가 있는 경우 제목 기준 검색
      query.title = { $regex: req.query.value, $options: 'i' }; //대소문자 무시
    }
    const posts = await db.collection('post') //조건에 맞는 글들 최신순 정렬
      .find(query)
      .sort({ date: -1 })
      .toArray();

    res.render('list.ejs', {
      data: posts, //게시물 목록
      totalCount: posts.length, //총 개수
      searchValue: req.query.value || '' //검색어 (없으면 빈 문자열)
    });
  } catch (err) {
    console.error('리스트 조회/검색 오류:', err);
    res.status(500).send('서버 오류');
  }
});

//게시물 작성 폼 페이지 출력 라우터
router.get('/enter', function(req, res){
  res.render('enter.ejs'); //enter.ejs 파일 렌더링
});

//게시물 작성 처리 라우터
router.post('/save', upload.none(), function(req, res){
    const db = req.db;
    const { title, content, someDate } = req.body; //폼에서 전달된 데이터 추출
    const imagepath = req.app.locals.imagepath || ''; //이미지 경로 (기본은 빈 문자열)
    const sessionUser = req.session.user; 

    if (!sessionUser || !sessionUser.userid) { //로그인하지 않은 경우
        return res.status(401).send(`
            <html>
            <head>
                <meta charset="UTF-8" />
                <title>로그인 필요</title>
                <script>
                setTimeout(function() {
                    window.location.href = '/login'; // 로그인 페이지 경로에 맞게 수정하세요
                }, 3000);
                </script>
            </head>
            <body>
                <h1>로그인 후 글을 작성할 수 있습니다.</h1>
                <p>3초 후에 로그인 페이지로 이동합니다.</p>
            </body>
            </html>
        `);
    }

    console.log(req.body.title);
    console.log(req.body.content);
    console.log(req.body.someDate);

    //post 컬렉션에 새로운 문서 삽입
    db.collection('post').insertOne({
        title,
        content,
        date: someDate,
        path: '', //기본적으로 이미지 없음
        userid: sessionUser.userid //작성자 정보 저장
    })
    .then(() => {
        res.redirect('/list'); //저장 성공 시 목록 페이지로 이동
        console.log('데이터 추가 성공');
    })  
    .catch(err => {
        console.error('게시글 저장 오류:', err);
        res.status(500).send('서버 오류');
    });
});


//게시물 삭제 라우터
router.post('/delete', async (req, res) => {
  const db = req.db;
  const ObjId = req.ObjId;
  try { //_id가 일치하는 문서 삭제
    await db.collection('post').deleteOne({ _id: new ObjId(req.body._id) });
    res.status(200).send();
  } catch (err) {
    console.error('삭제 오류:', err);
    res.status(500).send();
  }
});

//특정 게시물 상세 페이지 출력 라우터
router.get('/content/:id', function(req, res){
    const db = req.db;
    const ObjId = req.ObjId; //ObjectId 함수
    const id = new ObjId(req.params.id); //url 파라미터로 받은 id를 ObjectId로 변환
    console.log(req.params.id); //id 출력

    db.collection("post") //해당 id의 게시물 조회
    .findOne({_id:id})
    .then((result)=>{
        console.log(result); //조회된 게시물 출력
        res.render("content.ejs", {data : result}); //결과 전달
    });
});

//특정 사용자의 글만 보여주는 라우터
router.get('/user/:userid', function(req, res){
    const db = req.db;
    const userid = req.params.userid; //ulr로부터 사용자 id 추출
    //해당 사용자 id 글만 조회
    db.collection('post').find({ userid: userid }).toArray()
    .then(result => { //user_feed.ejs로 전달
        res.render('user_feed.ejs', { data: result, userid: userid });
    });
});

//글 수정 폼 페이지 출력 라우터
router.get('/edit/:id', function(req, res){
    const db = req.db;
    const ObjId = req.ObjId;
    const id = new ObjId(req.params.id);
    db.collection("post").findOne({_id : id}) //해당 글 조회 후 수정 폼 렌더링
    .then((result) => {
        console.log(result); //글 정보 출력
        res.render("edit.ejs", {data:result}); //수정 폼에 전달
    })
});

//글 수정 처리 라우터
router.post('/edit', upload.single('picture'), async (req, res) => {
  const db = req.db;
  const ObjId = req.ObjId;
  const id = new ObjId(req.body.id);

  try {
    const old = await db.collection('post').findOne({ _id: id }); //기존 게시물 조회
    if (!old) return res.status(404).send('게시글이 없습니다.'); //없으면 404

    const update = { //수정된 게시물 정보
      title: req.body.title,
      content: req.body.content,
      date: req.body.someDate
    };

    //새 이미지 업로드가 있는 경우
    if (req.file) {
      if (old.path) { //기존 이미지가 있는 경우 삭제
        fs.unlink(path.join(__dirname, '..', 'public', old.path), err => {
          if (err && err.code !== 'ENOENT') console.error('파일 삭제 실패:', err);
        });
      }
      update.path = '/image/' + req.file.filename; //새 이미지 경로 저장
    }
    //이미지 삭제 요청이 있는 경우
    else if (req.body.removeImage === 'on') {
      if (old.path) {
        fs.unlink(path.join(__dirname, '..', 'public', old.path), err => {
          if (err && err.code !== 'ENOENT') console.error('파일 삭제 실패:', err);
        });
      }
      update.path = ''; //이미지 제거
    }
    //DB에 게시물 정보 업데이트
    await db.collection('post').updateOne({ _id: id }, { $set: update });
    res.redirect('/list'); //수정 후 목록으로 이동
  } catch (err) {
    console.error('수정 처리 오류:', err);
    res.status(500).send('수정 중 오류 발생');
  }
});

module.exports = router; //라우터 모듈 외부로 내보내기