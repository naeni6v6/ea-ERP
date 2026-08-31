/** @type {import('next').NextConfig} */
// NEXT_PUBLIC_DEMO=1 빌드가 운영용 .next 를 덮어쓰지 않도록, 데모 관련 플래그가 하나라도 켜져 있으면 항상 .next-demo 로 분리한다.
const demoExport = process.env.DEMO_EXPORT === '1' || process.env.NEXT_PUBLIC_DEMO === '1';

// DEMO_EXPORT=1 이면 Netlify 드래그앤드롭용 정적 사이트(out/)를 만든다.
// distDir를 분리해 로컬 프로덕션 서버(.next)를 건드리지 않는다.
const nextConfig = {
  reactStrictMode: true,
  ...(demoExport
    ? { output: 'export', distDir: '.next-demo', images: { unoptimized: true } }
    : {}),
};

export default nextConfig;
