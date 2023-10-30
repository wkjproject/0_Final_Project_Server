import { users } from '../mongo.mjs';

export const middleAuth = (req, res, next) => {
  // 인증처리

  // 클라이언트 로컬스토리지에서 토큰 가져오기
  // 클라이언트로부터 'Authorization' 헤더를 읽어옴
  const authHeader = req.headers['authorization'];
  const refreshToken = req.headers['x-refresh-token'];
  // 클라이언트로부터 _id 읽어옴
  const _id = req.query._id;
  // 'Authorization' 헤더가 존재하고, 'Bearer' 스키마를 사용한 경우에만 처리
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.split(' ')[1]; // 'Bearer ' 다음의 토큰 부분을 추출
    // findByToken 을 사용해 토큰을 복호화하고 해당 유저를 DB에서 찾기
    // 토큰을 서버에 저장하지말고 클라이언트로부터 _id를 같이 받아서 복호화한 jwt토큰과 _id가 일치하는지 확인
    users
      .findByToken(accessToken, refreshToken)
      .then((decodedId) => {
        if (!_id || decodedId !== _id) {
          req.isLogin = false; // 인증 실패 시 isLogin 값을 false로 설정
          next();
        } else {
          req.isLogin = true; // 인증 성공 시 isLogin 값을 true로 설정
          next();
        }
      })
      .catch((err) => {
        console.log('middleAuth', err);
      });
  } else {
    // 'Authorization' 헤더가 없거나 올바른 스키마를 사용하지 않은 경우에 대한 처리
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
