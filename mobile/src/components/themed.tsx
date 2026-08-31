import React from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextProps,
  type TextInputProps,
} from 'react-native';
import { ft } from '../theme';

/**
 * Pretendard 기본 적용 Text/TextInput.
 * RN 0.81의 Text는 ref-as-prop 방식의 평범한 함수 컴포넌트라 render 패치가 통하지 않는다.
 * 기본 글꼴은 이 래퍼를 import해서 쓰는 것으로 보장한다 —
 * 앱 코드에서는 react-native의 Text/TextInput 대신 반드시 이것을 쓸 것.
 * (굵은 글씨는 스타일의 ft.semibold/bold/extrabold가 이 기본값을 덮는다)
 */
export function Text({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={[ft.regular, style]} />;
}

export function TextInput({ style, ...rest }: TextInputProps) {
  return <RNTextInput {...rest} style={[ft.regular, style]} />;
}
