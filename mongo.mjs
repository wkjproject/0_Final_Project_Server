import mongoose from 'mongoose';
import { usersSchema } from './mongoSchema/usersSchema.mjs';
import { projectsSchema } from './mongoSchema/projectsSchema.mjs';
import { userProjectsSchema } from './mongoSchema/userProjectsSchema.mjs';
import { verifiCodeSchema } from './mongoSchema/verifiCodeSchema.mjs';
import { fundingsSchema } from './mongoSchema/fundingsSchema.mjs';
import jwt from 'jsonwebtoken';
import { projidcounterSchema } from './mongoSchema/projIdcounterSchema.mjs';
import cron from 'node-cron';

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

// JWT 리프레쉬 토큰 생성
usersSchema.methods.generateToken = function (cb) {
  // 리프레쉬토큰과 엑세스 토큰의 만료시간을 동일하게해 리프레쉬토큰의 보안을 강화
  const refreshTokenExpTime = '10m'; // jwt 리프레쉬토큰 만료시간 지정
  const accessTokenExpTime = '1m'; // jwt 엑세스토큰 만료시간 지정
  const tokenExp = new Date();
  const refreshSecretKey = 'team6mongoRefresh';
  const accessSecretKey = 'team6mongoAccess';
  tokenExp.setMinutes(tokenExp.getMinutes() + 10); // 현재 시간에 10분을 추가
  // 사용자의 ID를 토큰 페이로드로 설정합니다.
  const payload = {
    _id: this._id, // 예: 사용자의 MongoDB _id
  };
  // 'team6mongoRefresh' 는 key로서 보안관리 필요
  const refreshToken = jwt.sign(payload, refreshSecretKey, {
    expiresIn: refreshTokenExpTime,
  });
  const accessToken = jwt.sign(payload, accessSecretKey, {
    expiresIn: accessTokenExpTime,
  });
  this.token = refreshToken;
  this.tokenExp = tokenExp;
  // mongoDB에 토큰 저장하는부분
  this.save()
    .then((data) => {
      cb(null, data, accessToken);
    })
    .catch((err) => {
      cb(err);
    });
};

// 엑세스 토큰 복호화, 엑세스 토큰 만료됐을때 리프레쉬토큰 쿠키로부터 받아와서 재발급
usersSchema.statics.findByToken = async function (accessToken, refreshToken) {
  const accessSecretKey = 'team6mongoAccess';
  const refreshSecretKey = 'team6mongoRefresh';
  const accessTokenExpTime = '1m'; // jwt 엑세스토큰 만료시간 지정
  try {
    const decoded = await jwt.verify(accessToken, accessSecretKey);
    return decoded._id;
  } catch (err) {
    console.error('Error in findByToken:', err);

    // 만료된 경우 리프레시 토큰을 검사하고 새로운 엑세스 토큰 발급
    if (err.name === 'TokenExpiredError') {
      if (refreshToken) {
        try {
          console.log('---------------------------------------------------');
          // 리프레쉬 코인 만료여부 조사
          const decodedRefreshToken = await jwt.verify(
            refreshToken,
            refreshSecretKey
          );
          // 리프레쉬토큰을 decode 한 결과의 _id와 서버에 저장된 refresh 토큰의 일치여부를 확인
          const user = await this.findOne({
            _id: decodedRefreshToken._id,
            token: refreshToken,
          });
          if (user) {
            // 리프레시 토큰이 유효한 경우, 새로운 엑세스 토큰 발급
            const newAccessToken = jwt.sign(
              { _id: decodedRefreshToken._id },
              accessSecretKey,
              { expiresIn: accessTokenExpTime }
            );
            // 새로운 엑세스 토큰을 클라이언트에게 보내줍니다 (예: res.cookie('accessToken', newAccessToken))
            return newAccessToken;
          } else {
            console.error('User not found for refreshToken:', refreshToken);
          }
        } catch (refreshTokenError) {
          console.error('Error in verifying refreshToken:', refreshTokenError);
        }
      }
    }
    return null;
  }
};

export const users = mongoose.model('users', usersSchema);
export const projects = mongoose.model('projects', projectsSchema);
export const userprojects = mongoose.model('userprojects', userProjectsSchema);
export const verifiCode = mongoose.model('verifiCode', verifiCodeSchema);
export const fundings = mongoose.model('fundings', fundingsSchema);
export const projidcounter = mongoose.model(
  'projidcounter',
  projidcounterSchema
);

// 10분마다 프로젝트 날짜가 지난 것들의 projStatus 값을 2로 변경
// 10분마다 실행하고자 하는 함수
function updateProjStatus() {
  const currentTime = new Date();
  const filter = {
    'projFundDate.0.projFundEndDate': { $lte: currentTime.toISOString() },
  };

  const update = {
    $set: { projStatus: '2' },
  };

  projects
    .updateMany(filter, update)
    .then((result) => {
      console.log(`10분마다 만료된 프로젝트 갱신 중...`);
    })
    .catch((error) => {
      console.error('업데이트 중 오류 발생:', error);
    });
}

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

//60초마다 함수 실행
cron.schedule('*/60 * * * * *', () => {
  updateProjStatus();
  removeExpiredTokens();
});
