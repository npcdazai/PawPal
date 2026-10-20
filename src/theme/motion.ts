import type { ComponentRef } from 'react';
import { Platform, type View } from 'react-native';

/** Native-driven animations everywhere except web, where only the JS driver exists. */
export const NATIVE_DRIVER = Platform.OS !== 'web';

/** Host instance of a <View> (RN 0.88 types View as a function component). */
export type ViewHandle = ComponentRef<typeof View>;
