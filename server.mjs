import express from 'express';
import cors from 'cors';
import {
  users,
  projects,
  userprojects,
  verifiCode,
  fundings,
  projidcounter,
} from './mongo.mjs';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import { middleAuth } from './middleWare/middleAuth.mjs';
import nodemailer from 'nodemailer';
import { randomCode } from './function/GenRandomCode.mjs';

const port = 5000;
const app = express();
app.use(
  cors({
    origin: true, // 출처 허용 옵션
    credentials: true, // 사용자 인증이 필요한 리소스(쿠키 등) 접근
  })
);
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
      await userFind.generateToken((err, data, accessToken) => {
        if (err) return res.status(400).send(err);
        // 리프레쉬토큰을 쿠키에 저장
        res
          .cookie('refreshToken', userFind.token, {
            httpOnly: true, // HTTP Only 설정
            secure: true, // HTTPS에서만 사용하도록 설정 (Production 환경에서)
          })
          .status(200)
          .json({
            loginSuccess: true,
            message: '로그인 성공',
            accessToken: accessToken,
            userName: userFind.userName,
            userAddr: userFind.userAddr,
            userPhoneNum: userFind.userPhoneNum,
            userMail: userFind.userMail,
            _id: userFind._id,
            userId: userFind.userId,
            isAdmin: userFind.role === 0 ? false : true, // role이 0이면 일반사용자, 0이아니면 운영자
            isLogin: true,
          });
        // token을 클라이언트로 보냄
        /*         res.status(200).json({
          loginSuccess: true,
          message: '로그인 성공',
          accessToken: accessToken,
          userName: userFind.userName,
          userAddr: userFind.userAddr,
          userPhoneNum: userFind.userPhoneNum,
          userMail: userFind.userMail,
          _id: userFind._id,
          userId: userFind.userId,
        }); */
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
app.post('/logout', async (req, res) => {
  try {
    const logoutUser = await users.findOneAndUpdate(
      { _id: req.body._id }, // middleAuth 의 foundUser
      {
        $set: {
          token: '',
          tokenExp: null,
        },
      }
    );
    if (!logoutUser) {
      return res.json({ logoutSuccess: false });
    }
    res.clearCookie('refreshToken');
    res.status(200).send({ logoutSuccess: true });
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
    // userId부분 counter로 받아서 집어넣기
    const counter = await projidcounter.findOneAndUpdate(
      {},
      { $inc: { seqUserId: 1 } },
      { new: true }
    );
    const nextSeq = counter.seqUserId;
    const data = {
      userName: userName,
      userMail: userMail,
      userPassword: hashedPwd,
      userPhoneNum: userPhoneNum,
      userAddr: userAddr,
      userId: nextSeq,
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
  } catch {}
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

// 마이페이지 펀딩프로젝트에서 사용자 결제 취소하는 부분
app.post('/cancelPayDB', async (req, res) => {
  try {
    // MongoDB에서 해당 funding_id와 일치하는 데이터를 삭제
    const result = await fundings.deleteOne({
      funding_id: req.body.funding_id,
    });

    // 삭제 됐을 때
    if (result) {
      res
        .status(200)
        .json({ cancelPaySuccess: true, message: '결제가 취소되었습니다.' });
    } else {
      // 해당 funding_id와 일치하는 데이터가 없을 때
      res.status(404).json({
        cancelPaySuccess: false,
        message: '데이터를 찾을 수 없습니다.',
      });
    }
  } catch (error) {
    // 오류 처리
    console.error(error);
    res.status(500).json({ message: '서버 오류입니다.' });
  }
});

// 마이페이지 제작프로젝트 부분

app.post('/madeProject', async (req, res) => {
  try {
    // userid정보로 바로 projects에 들어가서 userMade_id 가 userid랑 같은거 가져오면됨
    const userMade = await projects
      .find({ userMade_id: req.body.user_id })
      .exec();
    if (userMade) {
      return res.status(200).json({
        mades: userMade,
      });
    }
    if (!userMade) {
      return res.status(200).json({
        message: '제작 프로젝트가 없습니다.',
      });
    }
  } catch (err) {
    console.log('server.mjs madeProject', err);
  }
});

// 마이페이지 관심프로젝트 부분

app.post('/likeProject', async (req, res) => {
  try {
    // userid정보로 바로 userprojects에 들어가서 userLikeProject를 가져와
    // projects 에서 userLikeProject와 proj_id가 같은걸 가져옴
    const userLike = await userprojects
      .findOne({ users_id: req.body.user_id })
      .exec();

    if (userLike) {
      const userLikeProject = await projects
        .find({ proj_id: { $in: userLike.userLikeProject } })
        .exec();
      return res.status(200).json({
        likes: userLikeProject,
      });
    }
    if (userLike) {
      return res.status(200).json({
        message: '관심 프로젝트가 없습니다.',
      });
    }
  } catch (err) {
    console.log('server.mjs likeProject', err);
  }
});

// 마이프로젝트 관심 프로젝트 삭제 부분

app.post('/cancelLike', async (req, res) => {
  try {
    // 받아온 user_id로 userprojects에서 userLikeProject를 확인하고
    // 받아온 proj_id를 userLikeProject에서 제외시키고 갱신함
    const userCancelLike = await userprojects.updateOne(
      { users_id: req.body.user_id },
      { $pull: { userLikeProject: req.body.proj_id } }
    );
    if (userCancelLike) {
      return res.status(200).json({ cancelLikeSuccess: true });
    } else {
      return res.status(200).json({ cancelLikeSuccess: false });
    }
  } catch (err) {
    console.log('server.mjs cancelLike', err);
  }
});

// 마이페이지 회원정보 수정 부분

app.post('/userProfileModify', async (req, res) => {
  const {
    userId,
    userNameChanged,
    userPhoneNumChanged,
    userAddrChanged,
    userPassword,
  } = req.body;
  try {
    if (userPassword === undefined) {
      // userPassword가 undefined 일때
      // userId 기준으로 회원을 찾아서 업데이트
      const userModifyData = await users.findOneAndUpdate(
        { userId: userId },
        {
          $set: {
            userName: userNameChanged,
            userPhoneNum: userPhoneNumChanged,
            userAddr: userAddrChanged,
          },
        }
      );
      return res.status(200).json({ userProfileModifySuccess: true });
    } else if (userPassword !== undefined) {
      // userPassword가 undefined 가 아닐때
      const hashedPwd = await bcrypt.hash(userPassword, 10);
      const userModifyData = await users.findOneAndUpdate(
        { userId: userId },
        {
          $set: {
            userName: userNameChanged,
            userPhoneNum: userPhoneNumChanged,
            userPassword: hashedPwd,
            userAddr: userAddrChanged,
          },
        }
      );
      return res.status(200).json({ userProfileModifySuccess: true });
    } else {
      return res.status(200).json({ userProfileModifySuccess: false });
    }
  } catch (err) {
    console.log('server.mjs userProfileModify', err);
  }
});

// 펀딩현황부분
app.post('/fundingStatus', async (req, res) => {
  try {
    // 클라이언트로부터 _id(proj_id)를 받아서
    // projects컬렉션에서 projFundGoal(목표액), projFundCollect(모인금액), projFundUserCount(후원자수)  projFundDate에 projFundEndDate (남은기간용도)
    const fundingStatusData = await projects.findOne({
      proj_id: req.body._id,
    });
    if (fundingStatusData) {
      return res.status(200).json({
        projName: fundingStatusData.projName,
        projFundGoal: fundingStatusData.projFundGoal,
        projFundCollect: fundingStatusData.projFundCollect,
        projFundUserCount: fundingStatusData.projFundUserCount,
        projFundDate: fundingStatusData.projFundDate,
        projMainImgPath: fundingStatusData.projMainImgPath,
        projReward: fundingStatusData.projReward,
      });
    }
  } catch (err) {
    console.log('server.mjs fundingStatus', err);
  }
});

// 펀딩 현황 세부내역(모달창) 부분
app.post('/fundingStatusModal', async (req, res) => {
  try {
    // fundings 컬렉션에 id(proj_id)와 project_id가 같은것만 전체 필드 다 가져오기
    const fundingStatusModalData = await fundings.find({
      project_id: req.body._id,
    });
    // fundings 컬렉션의 user_id 중복제거
    if (fundingStatusModalData) {
      // fundingStatusModalData 에 해당하는 유저들 user_id 중복제거
      const uniqueUserIds = [
        ...new Set(fundingStatusModalData.map((item) => item.user_id)),
      ];
      // users 컬렉션에서 uniqueUserIds에 해당하는 userName 가져오기
      const fundingStatusModalUserName = await users.find(
        { userId: { $in: uniqueUserIds } },
        { userId: 1, userName: 1, _id: 0 }
      );
      return res.status(200).json({
        fundingStatusModalData: fundingStatusModalData,
        fundingStatusModalUserName: fundingStatusModalUserName,
        fundingStatusModalDataSuccess: true,
      });
    }
    if (!fundingStatusModalData) {
      return res.status(200).json({
        fundingStatusModalDataSuccess: false,
      });
    }
  } catch (err) {
    console.log('server.mjs fundingStatusModal', err);
  }
});

// 펀딩 현황 세부내역에서 대기 / 확정 / 거절 버튼 누르면 해당 status로 변경
app.post('/fundingStatusModalChangeStatus', async (req, res) => {
  try {
    // 클라이언트로부터 받은 funding_id로 찾고 fundingStatus를 statusChangeNumber 로 변경
    const fundingStatusModalChangeStatusData = await fundings.findOneAndUpdate(
      { funding_id: req.body.funding_id },
      {
        $set: {
          fundingStatus: req.body.statusChangeNumber,
        },
      }
    );
    if (fundingStatusModalChangeStatusData) {
      res.status(200).json({ statusChangeSuccess: true });
    }
    if (!fundingStatusModalChangeStatusData) {
      res.status(200).json({ statusChangeSuccess: false });
    }
  } catch {}
});

// 프로젝트 등록 부분
app.post('/createProj', async (req, res) => {
  // 클라이언트로부터 정보 받기
  const imgUrl = req.body.uploadImgUrl;
  const userId = req.body.userId;
  // proj_id를 위한 번호 생성
  const counter = await projidcounter.findOneAndUpdate(
    {},
    { $inc: { seq: 1 } },
    { new: true }
  );
  const nextSeq = counter.seq;

  // projDate를 위한 추출
  const times = req.body.projReward.map((reward) => reward.projRewardName);
  const data = {
    proj_id: nextSeq,
    projFundGoal: parseInt(req.body.goalAmount),
    userMade_id: userId,
    projName: req.body.projName,
    projRegion: parseInt(req.body.projRegion),
    projDesc: req.body.projDesc,
    projPlace: req.body.projPlace,
    projMainImgPath: imgUrl,
    projTag: parseInt(req.body.projTag),
    projAddr: req.body.projAddr,
    projDate: times,
    projReward: req.body.projReward,
    projFundDate: [
      {
        projFundStartDate: req.body.projFundStartDate,
        projFundEndDate: req.body.projFundEndDate,
      },
    ],
  };
  const sendData = new projects(data);
  sendData.save();
  res.status(200).json({ success: true });
});

// 프로젝트 수정 부분
app.post('/modifyProj', async (req, res) => {
  // _id(proj_id) 기반으로 서버에 등록된 프로젝트를 가져오기
  const modifyProjData = await projects.findOne({
    proj_id: req.body._id,
  });
  if (modifyProjData) {
    return res.status(200).json({
      modifyProjData,
    });
  }
  if (!modifyProjData) {
    return res.status(401).json({
      Success: false,
    });
  }
});

// 사용자 인증부분
app.get('/auth', middleAuth, async (req, res) => {
  try {
    if (req.isLogin === false) {
      // 인증에 실패한 경우
      res.status(200).json({ isLogin: false, accessToken: '' });
    } else {
      // 리프레쉬토큰으로 엑세스토큰을 재발급받았을때와 엑세스토큰이 만료안됐을때 처리
      if (req.accessToken !== undefined) {
        res.status(200).json({ isLogin: true, accessToken: req.accessToken });
      } else {
        res.status(200).json({ isLogin: true, accessToken: '' });
      }
    }
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

// 프로젝트 모두 가져오는 예시
app.get('/projects', async (req, res) => {
  try {
    const allProjects = await projects.find({});
    res.status(200).json({ projects: allProjects });
  } catch (err) {
    console.log(err);
  }
});

// 프로젝트 상세페이지 MenuTabs에서 제작자 정보 불러오기
app.post('/menuTabs', async (req, res) => {
  // 클라이언트로부터 userMade_id 를 받아서 users 컬렉션의 userId와 일치하는 users_id, userName, userMail, userPhoneNum 보내기
  try {
    const createProjUser = await users.findOne({
      userId: req.body.userMade_id,
    });
    if (createProjUser) {
      return res.status(200).json({
        users_id: createProjUser.userId,
        userName: createProjUser.userName,
        userMail: createProjUser.userMail,
        userPhoneNum: createProjUser.userPhoneNum,
      });
    }
    if (!createProjUser) {
      return res.status(401).json({
        Success: false,
      });
    }
  } catch (err) {
    console.error('server.mjs menuTabs', err);
  }
});

// RewardSelect에서 하트 클릭시
app.post('/heartClicked', async (req, res) => {
  try {
    const heartProjLike = await projects.findOne({ proj_id: req.body._id });
    // 클라이언트로부터 받은 heartStatus가 0이면 userprojects 컬렉션에 userId로 찾아서 userLikeProject 필드에 0이면 _id 삭제, 1이면 _id 추가
    if (req.body.heartStatus === 0) {
      const unHeart = await userprojects.findOneAndUpdate(
        { users_id: req.body.userId },
        {
          $unset: {
            userLikeProject: req.body._id,
          },
        },
        { upsert: true } // upsert 옵션 설정해서 필드가 없을경우 생성
      );
      // projects 필드의 projLike 값 갱신
      heartProjLike.projLike = heartProjLike.projLike - 1;
      heartProjLike.save();
    }
    if (req.body.heartStatus === 1) {
      const onHeart = await userprojects.findOneAndUpdate(
        { users_id: req.body.userId },
        {
          $set: {
            userLikeProject: req.body._id,
          },
        },
        { upsert: true } // upsert 옵션 설정해서 필드가 없을경우 생성
      );
      heartProjLike.projLike = heartProjLike.projLike + 1;
      heartProjLike.save();
    }
  } catch (err) {
    console.log('server.mjs heartClicked', err);
  }
});

// RewardSelect에서 유저가 하트 클릭한 프로젝트인지 확인
app.post('/userHeartClicked', async (req, res) => {
  try {
    // 클라이언트로부터 userId와 _id(proj_id)를 받아 userprojects 컬렉션에 userId로 찾아서 userLikeProject 필드에 _id (proj_id) 가 있는지 확인
    const userProjectDocument = await userprojects.findOne({
      users_id: req.body.userId,
    });
    if (userProjectDocument) {
      // userLikeProject 필드(array)에서 projectId가 있는지 확인
      const userLikeProject = userProjectDocument.userLikeProject || [];
      const isProjectLiked = userLikeProject.includes(req.body._id);

      if (isProjectLiked) {
        // projectId가 userLikeProject 배열에 있음
        return res.status(200).json({ Success: true });
      } else {
        // projectId가 userLikeProject 배열에 없음
        return res.status(200).json({ Success: false });
      }
    } else {
      // userId에 해당하는 문서가 없음
      return res.status(200).json({ Success: false });
    }
  } catch (err) {
    console.log('server.mjs userHeartClicked', err);
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
      { proj_id: req.body.proj_id },
      {
        $set: {
          projStatus: req.body.projStatus,
        },
      }
    );
    

    if (newProjStatusUpdate) {
      return res.status(200).json({
        newProjStatusSuccess: true,
        message: '프로젝트 상태변경 성공',
      });
    }
    if (!newProjStatusUpdate) {
      return res.status(200).json({
        newProjStatusSuccess: false,
        message: '프로젝트 상태변경 실패',
      });
    }
  } catch (err) {
    console.log('server.mjs newProjStatus', err);
  }
});

// 회원관리 페이지에서 회원관리 정보 조회하는 부분
app.get('/usersInfo', async (req, res) => {
  try {
    const userData = await users.find(
      {},
      'userId userName userMail userPhoneNum userAddr role'
    );
    res.status(200).json(userData);
  } catch (err) {
    console.log('server.mjs usersInfo', err);
  }
});

// 회원관리 페이지에서 회원 탈퇴처리하는 부분
app.post('/byeUserDB', async (req, res) => {
  try {
    // MongoDB에서 해당 userMail 일치하는 데이터를 삭제
    const result = await users.deleteOne({
      userMail: req.body.userMail,
    });

    // 삭제 됐을 때
    if (result) {
      res
        .status(200)
        .json({ byeUserSuccess: true, message: '회원 탈퇴가 처리되었습니다.' });
    } else {
      // 해당 userMail 일치하는 데이터가 없을 때
      res.status(404).json({
        byeUserSuccess: false,
        message: '데이터를 찾을 수 없습니다.',
      });
    }
  } catch (error) {
    // 오류 처리
    console.error(error);
    res.status(500).json({ message: '서버 오류입니다.' });
  }
});

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
  console.log(`${port}번 포트`);
});
