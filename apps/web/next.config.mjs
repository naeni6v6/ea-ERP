/** @type {import('next').NextConfig} */
const demoExport = process.env.DEMO_EXPORT === '1';

// DEMO_EXPORT=1 이면 Netlify 드래그앤드롭용 정적 사이트(out/)를 만든다.
// distDir를 분리해 로컬 프로덕션 서버(.next)를 건드리지 않는다.
const nextConfig = {
  reactStrictMode: true,
  ...(demoExport
    ? { output: 'export', distDir: '.next-demo', images: { unoptimized: true } }
    : {}),
};

export default nextConfig;
