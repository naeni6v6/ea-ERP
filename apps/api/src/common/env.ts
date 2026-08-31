/**
 * 필수 비밀값은 기본값으로 때우지 않는다.
 * 예전에는 JWT_SECRET이 없으면 'dev-secret'으로 조용히 떠서, 설정을 빠뜨린 서버는
 * 누구나 토큰을 위조할 수 있는 상태로 운영될 수 있었다. 이제는 아예 기동하지 않는다.
 */
export function requiredSecret(name: string): string {
  const v = (process.env[name] ?? '').trim();
  if (!v) {
    throw new Error(
      `[설정 오류] 환경변수 ${name} 가 비어 있습니다. apps/api/.env 에 값을 넣고 다시 시작하세요.`,
    );
  }
  if (v.length < 24) {
    throw new Error(`[설정 오류] ${name} 가 너무 짧습니다(${v.length}자). 24자 이상의 임의 문자열을 쓰세요.`);
  }
  const weak = ['change-me-to-a-long-random-string', 'dev-secret', 'secret', 'changeme'];
  if (weak.includes(v.toLowerCase())) {
    throw new Error(`[설정 오류] ${name} 가 예시값 그대로입니다. 실제 임의 문자열로 바꾸세요.`);
  }
  return v;
}
