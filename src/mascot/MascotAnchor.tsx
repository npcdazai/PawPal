import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  type NativeStackNavigationProp,
} from 'expo-router';
import {
  NATIVE_DRIVER,
  type AnchorRequest,
  type MascotScrollHandle,
  type ViewHandle,
} from './MascotMachine';
import { useMascotAnchorApi } from './MascotProvider';

/** Claim anyway if no native transition reports in (first screen, web). */
const SETTLE_FALLBACK_MS = 550;
/** Safety net once a native transition has started. */
const TRANSITION_TIMEOUT_MS = 1200;

const ScrollContext = createContext<MascotScrollHandle | null>(null);

interface MascotScrollViewProps extends Omit<ScrollViewProps, 'onScroll'> {
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  children: ReactNode;
}

/**
 * A ScrollView whose offset the mascot stage follows, so Barnaby scrolls with
 * the content while still living on the persistent overlay layer.
 */
export function MascotScrollView({ scrollRef, style, children, ...rest }: MascotScrollViewProps) {
  const viewportRef = useRef<ViewHandle>(null);
  const originRef = useRef<ViewHandle>(null);
  const [scrollY] = useState(() => new Animated.Value(0));
  const { remeasure } = useMascotAnchorApi();

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: NATIVE_DRIVER,
      }),
    [scrollY]
  );

  const handle = useMemo<MascotScrollHandle>(
    () => ({ scrollY, originRef, viewportRef }),
    [scrollY]
  );

  return (
    <View
      ref={viewportRef}
      style={[styles.viewport, style]}
      onLayout={() => remeasure()}
    >
      <ScrollContext.Provider value={handle}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          {...rest}
        >
          {/* Zero-size marker at the content origin: measuring it yields the live scroll offset. */}
          <View ref={originRef} pointerEvents="none" style={styles.origin} />
          {children}
        </Animated.ScrollView>
      </ScrollContext.Provider>
    </View>
  );
}

interface MascotAnchorProps {
  /** Stable per screen. */
  id: string;
  /** Rendered mascot size; the placeholder reserves exactly this box. */
  size: number;
  /** Barnaby ducks behind this view's top edge (STATE_PEEKING_DUCK). */
  clipRef?: RefObject<ViewHandle | null>;
  style?: StyleProp<ViewStyle>;
}

/**
 * Marks where Barnaby stands on a screen. When the screen gains focus and its
 * slide transition finishes, the anchor claims the persistent mascot, which
 * then walks in (STATE_ENTER_FROM_RIGHT); on blur it releases him.
 */
export function MascotAnchor({ id, size, clipRef, style }: MascotAnchorProps) {
  const scroll = useContext(ScrollContext);
  const anchorRef = useRef<ViewHandle>(null);
  const { claim, release, remeasure } = useMascotAnchorApi();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();

  useFocusEffect(
    useCallback(() => {
      if (!scroll) return undefined;
      const request: AnchorRequest = { id, size, anchorRef, scroll, clipRef };
      let claimed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const claimOnce = () => {
        if (claimed) return;
        claimed = true;
        clearTimeout(timer);
        claim(request);
      };
      const arm = (ms: number) => {
        clearTimeout(timer);
        timer = setTimeout(claimOnce, ms);
      };

      const offStart = navigation.addListener('transitionStart', (event) => {
        if (!event.data.closing) arm(TRANSITION_TIMEOUT_MS);
      });
      const offEnd = navigation.addListener('transitionEnd', (event) => {
        if (!event.data.closing) claimOnce();
      });
      arm(SETTLE_FALLBACK_MS);

      return () => {
        claimed = true;
        clearTimeout(timer);
        offStart();
        offEnd();
        release(id);
      };
    }, [id, size, clipRef, scroll, claim, release, navigation])
  );

  return (
    <View
      ref={anchorRef}
      pointerEvents="none"
      onLayout={() => remeasure(id)}
      style={[{ width: size, height: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
  },
  origin: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },
});
