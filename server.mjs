import express from 'express';
import cors from 'cors';
import {
  users,
  projects,
  userProjects,
  countProjects,
  verifiCode,
  fundings,
} from './mongo.mjs';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import { middleAuth } from './middleWare/middleAuth.mjs';
import nodemailer from 'nodemailer';
import { randomCode } from './function/GenRandomCode.mjs';

const port = 5000;
const app = express();
app.use(cors({}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
//const bodyParser = require('body-parser');

//일반 로그인 부분
app.post('/login', async (req, res) => {
  try {
    // 서버의 userMail과 클라이언트의 userMail을 비교하는 부분
    const userFind = await users
      .findOne({ userMail: req.body.userMail })
      .exec();

    if (!userFind) {
      return res.json({
        loginSuccess: false,
        // 차후 보안을 위해 문구를 이메일 또는 비밀번호가 틀렸습니다. 라고 교체
        message: '해당되는 이메일이 없습니다.',
      });
    }
    // 이메일이 DB에 있을 경우 비밀번호 확인하는 부분
    // bcrypt를 사용해 bcrypt.compare로 비교
    const checkUserPwd = await bcrypt.compare(
      req.body.userPassword,
      userFind.userPassword
    );
    if (checkUserPwd) {
      await userFind.generateToken((err, data) => {
        if (err) return res.status(400).send(err);
        // token을 클라이언트로 보냄
        res.status(200).json({
          loginSuccess: true,
          message: '로그인 성공',
          token: userFind.token,
          userName: userFind.userName,
          _id: userFind._id,
          userId: userFind.userId,
        });
      });
    } else {
      res.status(200).json({
        loginSuccess: false,
        message: '비밀번호가 틀렸습니다.',
      });
    }
  } catch (e) {
    res.status(500).json({ loginSuccess: false, message: '서버 에러' });
  }
});

// 카카오 로그인 부분
app.post('/login/kakao', async (req, res) => {
  try {
    //req.body.userMail : 카카오아이디, req.body.token : 카카오토큰
    const userFind = await users
      .findOne({ userMail: req.body.userMail })
      .exec();
    if (!userFind) {
      const sendData = new users(req.body);
      sendData.save();
      const userFindKakao = await users
        .findOne({ userMail: req.body.userMail }) //findOne은 일치하는 하나의 값만 가져옴
        .exec();
      await userFindKakao.generateToken((err, data) => {
        if (err) return res.status(400).send(err);
        // token을 클라이언트로 보냄
        return res.status(200).json({
          kakaoLoginSuccess: true,
          message: '로그인 성공',
          token: userFindKakao.token,
          userName: userFindKakao.userName,
          _id: userFindKakao._id,
        });
      });
    }
    if (userFind) {
      await userFind.generateToken((err, data) => {
        if (err) return res.status(400).send(err);
        // token을 클라이언트로 보냄
        return res.status(200).json({
          kakaoLoginSuccess: true,
          message: '로그인 성공',
          token: userFind.token,
          userName: userFind.userName,
          _id: userFind._id,
        });
      });
    }
  } catch (err) {
    console.log(err);
  }
});

// 네이버 로그인 부분

// 로그아웃 부분
app.get('/logout', middleAuth, async (req, res) => {
  try {
    const logoutUser = await users.findOneAndUpdate(
      { _id: req.foundUser._id }, // middleAuth 의 foundUser
      { token: '' },
      { tokenExp: null }
    );
    if (!logoutUser) {
      return res.json({ logoutSuccess: false });
    }
    return res.status(200).send({ logoutSuccess: true });
  } catch (err) {
    return res.json({ logoutSuccess: false, err });
  }
});

// 회원가입 부분
app.post('/signup', async (req, res) => {
  try {
    const { userName, userMail, userPassword, userPhoneNum, userAddr } =
      req.body;
    const hashedPwd = await bcrypt.hash(userPassword, 10);
    const data = {
      userName: userName,
      userMail: userMail,
      userPassword: hashedPwd,
      userPhoneNum: userPhoneNum,
      userAddr: userAddr,
    };
    await users.insertMany([data]);
    return res.status(200).json({ signupSuccess: true });
  } catch (err) {
    console.log(err);
  }
});

//회원가입 이메일 중복확인, 아이디 찾기 부분
app.post('/signup/userMailCheck', async (req, res) => {
  try {
    const userFindMail = await users
      .findOne({ userMail: req.body.userMail })
      .exec();
    if (!userFindMail) {
      // 중복확인이기때문에 사용자가 존재하지않을때 true
      return res.status(200).json({ userMailCheck: true });
    }
    if (userFindMail) {
      //중복확인이기때문에 사용자가 존재하면 false
      return res.status(200).json({ userMailCheck: false });
    }
  } catch (err) {
    console.log(err);
  }
});

// 비밀번호 찾기에서 인증번호 받기 부분
app.post('/pwCodeMailSend', async (req, res) => {
  try {
    const userFindMail = await users
      .findOne({ userMail: req.body.userMail })
      .exec();
    // 현재 DB에 해당 유저가 존재하고 role 이 1이 아닐때만
    if (userFindMail && userFindMail.role !== 1) {
      const random = randomCode();
      const transporter = nodemailer.createTransport({
        host: 'smtp.zoho.com',
        secure: true,
        port: 465,
        // 비밀번호는 차후 보안강화예정
        auth: {
          user: 'team6mongo@zohomail.com',
          pass: 'PsFe51X6pjhA',
        },
      });
      const mailOption = {
        from: 'team6mongo@zohomail.com',
        to: req.body.userMail,
        subject: 'WW 비밀번호 찾기 인증번호',
        text: `인증번호는 ${random} 입니다.`,
      };
      const data = {
        userMail: req.body.userMail,
        userMailVerifiNum: random,
      };
      const sendData = new verifiCode(data);
      sendData.save();
      transporter.sendMail(mailOption, function (err, info) {
        if (err) {
          return res.status(500).json({ sendMailSuccess: false, message: err });
        } else {
          return res
            .status(200)
            .json({ sendMailSuccess: true, message: '인증번호 발송 성공' });
        }
      });
    }
    if (!userFindMail) {
      return res.json({
        sendMailSuccess: false,
        message: '등록되지 않은 이메일입니다.',
      });
    }
  } catch (err) {
    console.log('server.mjs 비밀번호 찾기 부분', err);
  }
});

// 비밀번호 찾기에서 인증번호 확인 부분
app.post('/verifiCode', async (req, res) => {
  try {
    const userFindMail = await verifiCode
      .findOne({ userMail: req.body.userMail })
      .exec();
    if (
      userFindMail &&
      userFindMail.userMailVerifiNum === req.body.verifiCode
    ) {
      return res
        .status(200)
        .json({ verificationSuccess: true, message: '인증번호가 일치합니다.' });
    } else {
      return res.status(200).json({
        verificationSuccess: false,
        message: '인증번호를 확인해주세요.',
      });
    }
  } catch { }
});

// 비밀번호 찾기에서 새로운 비밀번호로 변경 부분
app.post('/newPassword', async (req, res) => {
  try {
    const hashedPwd = await bcrypt.hash(req.body.userPassword, 10);
    const newPasswordUpdate = await users.findOneAndUpdate(
      { userMail: req.body.userMail },
      { userPassword: hashedPwd }
    );
    if (newPasswordUpdate) {
      return res
        .status(200)
        .json({ newPasswordSuccess: true, message: '비밀번호 변경 성공' });
    }
    if (!newPasswordUpdate) {
      return res
        .status(200)
        .json({ newPasswordSuccess: false, message: '비밀번호 변경 실패' });
    }
  } catch (err) {
    console.log('server.mjs newPassword', err);
  }
});

// 마이페이지 펀딩프로젝트 부분
app.post('/fundingProject', async (req, res) => {
  try {
    const userFindIds = await fundings
      .find({ user_id: req.body.user_id })
      .exec();
    const projectIds = userFindIds.map((item) => item.project_id);

    const matchingProjects = [];
    for (const projectId of projectIds) {
      const project = await projects.find({ proj_id: projectId }).exec();
      matchingProjects.push(project);
    }

    return res.status(200).json({
      fundings: userFindIds,
      projects: matchingProjects,
    });
  } catch (err) {
    console.log('server.mjs fundingProject', err);
  }
});

// 사용자 인증부분
app.get('/auth', middleAuth, (req, res) => {
  try {
    // 사용자 _id(몽고DB 고유 _id) + 로컬스토리지 토큰 과 서버에 있는 _id + 토큰을 비교해 일치할경우 다음과같은 응답
    res.status(200).json({
      _id: req.foundUser._id, // middleAuth 에서 제공한 foundUser
      userId: req.foundUser.userId,
      isAdmin: req.foundUser.role === 0 ? false : true, // role이 0이면 일반사용자, 0이아니면 운영자
      isLogin: true,
    });
  } catch (err) {
    console.log('server.mjs', err);
  }
});

//홈에서 유저네임불러오는 테스트용
app.get('/projName', async (req, res) => {
  try {
    const projName = await projects.find({}, 'projName');
    res.status(200).json({ projName });
  } catch (err) {
    console.log(err);
  }
});

// 프로젝트 상태: projStatus
app.get('/projStatus', async (req, res) => {
  try {
    const projStatus = await projects.find({}, 'projStatus');
    res.status(200).json({ projStatus });
  } catch (err) {
    console.log(err);
  }
});

// 프로젝트 승인/거절 페이지에서 프로젝트 승인상태 변경하는 부분
app.post('/newProjStatus', async (req, res) => {
  try {
    const newProjStatusUpdate = await projects.findOneAndUpdate(
      { projStatus: req.body.projStatus },
    );

    if (newProjStatusUpdate) {
      return res
        .status(200)
        .json({ newProjStatusSuccess: true, message: '프로젝트 상태변경 성공' });
    }
    if (!newProjStatusUpdate) {
      return res
        .status(200)
        .json({ newProjStatusSuccess: false, message: '프로젝트 상태변경 실패' });
    }
  } catch (err) {
    console.log('server.mjs newProjStatus', err);
  }
});


app.listen(port, () => {
  console.log(`http://localhost:${port}`);
  console.log(`${port}번 포트`);
});