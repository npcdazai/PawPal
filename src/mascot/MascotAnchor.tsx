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
  type AnchorOffset,
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

/**
 * A non-scrolling area Barnaby can stand in (a map, a dialog). Sized by its
 * own layout, unlike MascotScrollView which needs a bounded height.
 */
export function MascotFrame({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const frameRef = useRef<ViewHandle>(null);
  const [scrollY] = useState(() => new Animated.Value(0));
  const { remeasure } = useMascotAnchorApi();

  // No scrolling: the frame is both the clip viewport and the content origin.
  const handle = useMemo<MascotScrollHandle>(
    () => ({ scrollY, originRef: frameRef, viewportRef: frameRef }),
    [scrollY]
  );

  return (
    <View ref={frameRef} style={style} onLayout={() => remeasure()}>
      <ScrollContext.Provider value={handle}>{children}</ScrollContext.Provider>
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
  /**
   * Live offset for a pin that travels: the placeholder stays put and Barnaby
   * is drawn this far from it (must be the same values that move the pin).
   */
  offset?: AnchorOffset;
  /**
   * Lets one screen hand Barnaby between spots (e.g. map pin → search dialog):
   * an inactive anchor releases him, and claims him again when re-activated.
   */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Marks where Barnaby stands on a screen. When the screen gains focus and its
 * slide transition finishes, the anchor claims the persistent mascot, which
 * then walks in (STATE_ENTER_FROM_RIGHT); on blur it releases him.
 */
export function MascotAnchor({
  id,
  size,
  clipRef,
  offset,
  active = true,
  style,
}: MascotAnchorProps) {
  const scroll = useContext(ScrollContext);
  const anchorRef = useRef<ViewHandle>(null);
  const { claim, release, remeasure } = useMascotAnchorApi();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();

  useFocusEffect(
    useCallback(() => {
      if (!scroll || !active) return undefined;
      const request: AnchorRequest = { id, size, anchorRef, scroll, clipRef, offset };
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
    }, [id, size, clipRef, offset, active, scroll, claim, release, navigation])
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
