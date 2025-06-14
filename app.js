const express = require('express'); //Express 모듈 불러오기
const app = express(); //app 객체 생성
const sha = require('sha256'); //sha256 해시 함수 모듈 불러오기
const dotenv = require('dotenv').config(); //.env 환경변수 설정 불러오기
const mongoclient = require("mongodb").MongoClient; //MongoDB 클라이언트
const bodyParser = require('body-parser'); //http 요청 본문 파싱 미들웨어
const cookieParser = require('cookie-parser'); //쿠키 파싱 미들웨어
const session = require('express-session'); //세션 처리 미들웨어
const ObjId = require('mongodb').ObjectId; //MongoDB의 ObjectId 타입 사용
const path = require('path'); //경로 관련 모듈 불러오기

//라우터 모듈 불러오기
const indexRouter = require('./routes/indexR');
const listRouter = require('./routes/listR');
const logRouter = require('./routes/logR');
const uploadRouter = require('./routes/uploadR');
const friendRouter = require('./routes/friendR');

//요청 바디 파싱 설정 (URL 인코딩된 데이터와 JSON 처리)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 정적 파일 제공 디렉토리 설정
app.use(express.static(__dirname + '/public'));

//EJS 템플릿 엔진 설정
app.set('view engine', 'ejs');

//세션 설정
app.use(session({
  secret : '683d8f2c74e886eaddb36d1a', //세션 암호화 키
  resave : false,  //매 요청마다 세션을 저장할 것인지 여부
  saveUninitialized : true //세션이 저장되기 전에 초기화할지 여부
}))

//매 요청마다 세션에 저장된 사용자 정보를 뷰에 자동으로 전달
app.use((req, res, next) => {
  res.locals.user = req.session.user; //모든 뷰에서 user 변수 사용 가능
  next(); 
});

//환경 변수에서 DB 연결 URL 가져오기
const url = process.env.DB_URL;
let mydb; //MongoDb 연결을 위한 변수 선언

mongoclient.connect(url).then(client =>{
    mydb = client.db('myboard'); //'myboard' 데이터베이스에 연결
    console.log('연결 성공');
    //MongoDB와 ObjectId를 요청 객체에 붙여서 라우터에서 쉽게 사용 가능하게 함
    app.use((req, res, next)=>{
    req.db = mydb;
    req.ObjId = ObjId;
    next();
    });

    app.get('/start', (req, res) => {
      console.log('/start 요청 들어옴');
      res.sendFile(path.join(__dirname, 'public', 'start.html'), (err) => {
        if (err) {
          console.error('sendFile 에러:', err);
          res.status(err.status).end();
        }
      });
    });     

    //라우터 등록
    app.use('/', indexRouter);
    app.use('/', listRouter);
    app.use('/', logRouter);
    app.use('/', uploadRouter);
    app.use('/', friendRouter);

    app.listen(process.env.PORT, () => { //서버 시작
        console.log(`포트 ${process.env.PORT}에서 서버 실행 중`);
    });
})
  .catch(err => {
    console.error('DB 연결 실패:', err);
    process.exit(1); //강제 종료
  });
