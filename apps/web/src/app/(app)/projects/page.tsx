import { redirect } from 'next/navigation';

/** 프로젝트 목록은 대시보드로 통합되었다 — 상세(/projects/[id])만 유지 */
export default function ProjectsPage() {
  redirect('/');
}
