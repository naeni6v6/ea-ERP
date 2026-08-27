import Image from 'next/image';

/**
 * MotionBridge 로고.
 * 원본이 검은 배경 위 글로우 이미지라 어두운 면 위에서만 자연스럽다.
 * `.logo-blend`(mix-blend-mode: screen)가 검은 배경을 지워준다.
 */
export function Logo({ height = 26, className = '' }: { height?: number; className?: string }) {
  const width = Math.round((height * 640) / 232);
  return (
    <Image
      src="/motionbridge-logo.png"
      alt="MotionBridge"
      width={width}
      height={height}
      priority
      className={`logo-blend h-auto w-auto select-none ${className}`}
    />
  );
}
