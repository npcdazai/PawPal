import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { NATIVE_DRIVER } from '../theme/motion';
import type { Walker } from '../data/careTeam';

interface ChatMessage {
  id: number;
  from: 'walker' | 'you';
  text: string;
}

interface WalkerChatSheetProps {
  walker: Walker;
  /** Walker's latest update, shown as the first message. */
  latest: string;
  quickReplies: readonly string[];
  onClose: () => void;
}

const AUTO_REPLY_MS = 1100;

/** One chat bubble; primitive props so earlier messages don't re-render. */
const ChatBubble = memo(function ChatBubble({ from, text }: Omit<ChatMessage, 'id'>) {
  const you = from === 'you';
  return (
    <View style={[styles.bubble, you ? styles.bubbleYou : styles.bubbleWalker]}>
      <Text style={[styles.bubbleText, you && styles.bubbleTextYou]}>{text}</Text>
    </View>
  );
});

const messageKey = (message: ChatMessage) => String(message.id);
const renderMessage = ({ item }: { item: ChatMessage }) => <ChatBubble from={item.from} text={item.text} />;
const BubbleGap = () => <View style={styles.bubbleGap} />;

/** Quick chat preview with the walker: tap a reply, the walker answers. */
export function WalkerChatSheet({ walker, latest, quickReplies, onClose }: WalkerChatSheetProps) {
  const insets = useSafeAreaInsets();
  const [enter] = useState(() => new Animated.Value(0));
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ id: 0, from: 'walker', text: latest }]);
  const [typing, setTyping] = useState(false);
  const seq = useRef(1);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
    const pending = replyTimer;
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, [enter]);

  const send = (text: string) => {
    seq.current += 1;
    const id = seq.current;
    setMessages((current) => [...current, { id, from: 'you', text }]);
    setTyping(true);
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      setTyping(false);
      setMessages((current) => [
        ...current,
        { id: id + 1000, from: 'walker', text: 'Got it! 👍 Barnaby says hi 🐾' },
      ]);
    }, AUTO_REPLY_MS);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: enter }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" aria-label="Close chat" />
      </Animated.View>
      <Animated.View
        role="dialog"
        aria-label={`Chat with ${walker.name}`}
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 14,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) }],
          },
        ]}
      >
        <View style={styles.header}>
          <Avatar initials={walker.initials} tint={walker.tint} ink={walker.ink} size={40} />
          <View style={styles.flex}>
            <Text style={styles.name}>{walker.name}</Text>
            <View style={styles.online}>
              <View style={styles.onlineDot} />
              <Text style={styles.meta}>{typing ? 'typing…' : 'Online • replies in ~1 min'}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" aria-label="Close chat" hitSlop={8}>
            <Icon name="close" size={22} color={colors.slate} />
          </Pressable>
        </View>

        <FlatList
          data={messages}
          keyExtractor={messageKey}
          renderItem={renderMessage}
          ItemSeparatorComponent={BubbleGap}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.replies}>
          {quickReplies.map((reply) => (
            <Pressable
              key={reply}
              onPress={() => send(reply)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.reply, pressed && styles.pressed]}
            >
              <Text style={styles.replyText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(24, 26, 32, 0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.float,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  name: {
    ...typography.subhead,
  },
  online: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  meta: {
    ...typography.bodySm,
  },
  thread: {
    maxHeight: 220,
  },
  threadContent: {
    paddingVertical: 4,
  },
  bubbleGap: {
    height: 8,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleWalker: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 6,
    backgroundColor: colors.stage,
  },
  bubbleYou: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 6,
    backgroundColor: colors.primary,
  },
  bubbleText: {
    ...typography.body,
    color: colors.ink,
  },
  bubbleTextYou: {
    color: colors.onPrimary,
  },
  replies: {
    gap: 8,
  },
  reply: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: colors.primaryTint,
  },
  replyText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
});
