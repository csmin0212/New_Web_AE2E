import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 새로 배포한 뒤 열려 있던 옛 화면이 사라진 스크립트를 찾다가 깨지지 않게:
  // 배포마다 다른 ID 를 붙이면, 서버 버전이 바뀐 걸 알아채고 페이지를 통째로 새로 불러온다.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID || undefined,
};

export default nextConfig;
