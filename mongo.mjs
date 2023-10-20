import mongoose from 'mongoose';
import { usersSchema } from './mongoSchema/usersSchema.mjs';
import { projectsSchema } from './mongoSchema/projectsSchema.mjs';
import { userProjectsSchema } from './mongoSchema/userProjectsSchema.mjs';
import { countProjectsSchema } from './mongoSchema/countProjectsSchema.mjs';
import { verifiCodeSchema } from './mongoSchema/verifiCodeSchema.mjs';
import { fundingsSchema } from './mongoSchema/fundingsSchema.mjs';
import jwt from 'jsonwebtoken';

const uri =
  'mongodb+srv://team6mongo:team6mongo@finalprojectteam6.psuivab.mongodb.net/Database'; //제일 뒤에 userData가 Database 이름

mongoose
  .connect(uri)
  .then(() => {
    console.log('MongoDB 연결 성공');
  })
  .catch((error) => {
    console.error('MongoDB 연결 실패: ', error);
  });

// JWT 토큰 생성
usersSchema.methods.generateToken = function (cb) {
  const tokenExpTime = '1h'; // jwt 토큰 만료시간 지정
  const tokenExp = new Date();
  const secretKey = 'team6mongo';

  tokenExp.setMinutes(tokenExp.getMinutes() + 1); // 현재 시간에 1분을 추가
  // 사용자의 ID를 토큰 페이로드로 설정합니다.
  const payload = {
    _id: this._id, // 예: 사용자의 MongoDB _id
  };
  // 'team6mongo' 는 key로서 보안관리 필요
  let token = jwt.sign(payload, secretKey, {
    expiresIn: tokenExpTime,
  });
  this.token = token;
  this.tokenExp = tokenExp;
  // mongoDB에 토큰 저장하는부분
  this.save()
    .then((data) => {
      cb(null, data);
    })
    .catch((err) => {
      cb(err);
    });
};

// 토큰 복호화

usersSchema.statics.findByToken = async function (token) {
  const thisUser = this;
  const secretKey = 'team6mongo';
  try {
    const decoded = await jwt.verify(token, secretKey); // _id 기반으로 jwt토큰을 만들었기때문에 디코드하면 _id가 나옴
    const user = await thisUser.findOne({
      _id: decoded._id,
      token: token,
    });
    return user;
  } catch (err) {
    console.error('Error in findByToken:', err);
    return null;
  }
};

export const users = mongoose.model('users', usersSchema);
export const projects = mongoose.model('projects', projectsSchema);
export const userProjects = mongoose.model('userProjects', userProjectsSchema);
export const countProjects = mongoose.model(
  'countProjects',
  countProjectsSchema
);
export const verifiCode = mongoose.model('verifiCode', verifiCodeSchema);
export const fundings = mongoose.model('fundings', fundingsSchema);

// 만료된 token, tokenExp '' 로 업데이트
function removeExpiredTokens() {
  const currentTime = new Date();

  users
    .updateMany(
      { tokenExp: { $lte: currentTime } },
      { $set: { token: '', tokenExp: null } }
    )
    .then(() => {
      console.log(`10분마다 만료된 토큰 삭제 중...`);
    })
    .catch((err) => {
      console.error(err);
    });
}

setInterval(removeExpiredTokens, 600000); // 10분마다 DB에서 만료된 토큰 삭제
