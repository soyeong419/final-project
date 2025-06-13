const express = require('express'); //Express 모듈 불러오기 
const multer = require("multer"); //파일 업로드를 위한 Multer 모듈 불러오기
const fs = require('fs'); //파일 시스템 관련 모듈 불러오기
const iconv = require('iconv-lite'); //문자 인코딩을 다루기 위한 iconv-lite 불러오기
const router = express.Router(); //라우터 객체 생성

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

//기존 이미지 업로드 처리 라우터
router.post('/photo', upload.single('picture'), (req, res) => {
    if (!req.file) { //업로드된 파일이 없으면 400 에러
        return res.status(400).send('파일이 업로드되지 않았습니다.');
    }

    const db = req.db; //DB 핸들러 가져오기
    const ObjId = req.ObjId; //생성자 가져오기
    const id = new ObjId(req.body.id); //게시글 id를 ObjectId로 변환
    const imagepath = '/image/' + req.file.filename;  //지정된 이미지 파일 경로

    //DB에 이미지 경로 업데이트
    db.collection("post").updateOne(
        { _id: id }, //_id가 게시물 id와 일치
        { $set: { path: imagepath } } //path 필드를 이미지 경로로 설정
    )
    .then(() => {
        console.log('파일 업로드 및 DB 업데이트 성공');
        res.redirect('/list');  //목록 페이지로 이동
    })
    .catch(err => {
        console.error(err);
        res.status(500).send('DB 업데이트 중 오류 발생');
    });
});

//이미지 삭제 라우터
router.post('/delete_image', (req, res) => {
    const db = req.db;
    const ObjId = req.ObjId;

    const id = new ObjId(req.body.id); 
    const imagePath = './public' + req.body.path;

    //파일이 존재하는지 확인
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath); //존재하면 동기적으로 파일 삭제
    }

    //DB에서 해당 게시물의 path 필드 제거
    db.collection("post").updateOne(
        { _id: id }, //게시물 id 일치
        { $unset: { path: "" } } //path 필드 삭제
    )
    .then(() => {
        res.redirect('/list');
    })
    .catch(err => {
        console.error(err);
        res.status(500).send('이미지 삭제 중 오류 발생');
    });
});

//파일 업로드 라우터
router.post('/upload_file', upload.single('file'), (req, res) => {
    const db = req.db;
    const sessionUser = req.session.user;

    if (!sessionUser || !sessionUser.userid) { //로그인하지 않은 경우
        return res.status(401).send(`
            <html>
            <head>
                <meta charset="UTF-8" />
                <title>로그인 필요</title>
                <script>
                setTimeout(function() {
                    window.location.href = '/login'; // 로그인 페이지 경로에 맞게 수정
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

    const filePath = req.file.path; //업로드된 파일 경로
    const originalnameBuffer = Buffer.from(req.file.originalname, 'latin1'); //원본 파일명
    const fileName = iconv.decode(originalnameBuffer, 'utf8');  //한글명 변환
    const mimetype = req.file.mimetype;

    if (mimetype === 'text/plain') { //텍스트 파일일 경우
        //텍스트 파일일 경우
        fs.readFile(filePath, 'utf8', (err, data) => { //UTF-8 인코딩으로 읽기
            if (err) {
                console.error('파일 읽기 오류:', err);
                return res.status(500).send('업로드 실패');
            }
            //읽은 텍스트 데이터를 DB에 새 게시물로 저장
            db.collection('post').insertOne({
                title: fileName.replace('.txt', ''), //파일명에서 확장자 제거 후 제목으로 사용
                content: data, //파일 내용 본문으로 저장
                date: new Date().toISOString().slice(0, 10), //현재 날짜
                path: '', //이미지 경로 없음
                userid: sessionUser.userid //로그인한 사용자 id 저장
            }).then(() => {
                console.log('텍스트 게시물 저장 완료');
                res.redirect('/list');  //저장 완료 후 목록 페이지로 이동
            });
        });
    } else if (mimetype.startsWith('image/')) { //이미지 파일일 경우
        const imagepath = '/image/' + fileName; //이미지 경로 생성
        req.app.locals.imagepath = imagepath; //전역변수로 이미지 경로 저장

        //이미지 게시글 DB에 저장
        db.collection('post').insertOne({
            title: req.body.title || fileName, //제목이 없으면 파일명으로 저장
            content: req.body.content || '', //본문이 없으면 빈 문자열
            date: new Date().toISOString().slice(0, 10),
            path: imagepath, //이미지 경로 저장
            userid: sessionUser.userid
        }).then(() => {
            console.log('이미지 게시물 저장 완료');
            res.redirect('/list');
        });
    } else { //지원하지 않는 파일 형식일 경우 에러
        res.status(400).send('지원하지 않는 파일 형식입니다.');
    }
});

module.exports = router; //라우터 모듈 외부로 내보내기
