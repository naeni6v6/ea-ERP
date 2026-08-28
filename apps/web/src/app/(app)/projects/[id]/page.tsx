import demoIds from '@/lib/demo-project-ids.json';
import { ProjectDetailClient } from './ProjectDetailClient';

/**
 * 서버 래퍼 — 정적 export(데모 배포) 시 알려진 프로젝트 id들을 미리 생성한다.
 * 일반 실행에서는 동적 라우팅이 그대로 동작하고, 화면 자체는 클라이언트 컴포넌트가 담당한다.
 */
export function generateStaticParams() {
  return (demoIds as string[]).map((id) => ({ id }));
}

export default function ProjectDetailPage() {
  return <ProjectDetailClient />;
}
